// Drives a page in the system's WKWebView - the WebKit Picnest runs in -
// for scripts/run.ts. Usage: wkdriver <url> [unlock]
//
// "unlock" turns off WebKit's PreferPageRenderingUpdatesNear60FPSEnabled,
// as apps/desktop/webview_darwin.go does, so the page renders at the
// display's rate (120Hz on ProMotion). Each line on stdin is a JSON string
// of a JavaScript expression; its awaited value comes back on stdout as one
// line, {"value": <JSON>} or {"error": "..."}. A "ready" line is printed
// once the page has loaded. The line "purge" instead empties WebKit's memory
// cache (WKWebsiteDataTypeMemoryCache, as an app could), replying
// {"value": null} once done; "snapshot <path>" writes what the view shows
// as a PNG.

import AppKit
import WebKit

let arguments = CommandLine.arguments
guard arguments.count >= 2, let url = URL(string: arguments[1]) else {
  FileHandle.standardError.write("usage: wkdriver <url> [unlock]\n".data(using: .utf8)!)
  exit(2)
}
let unlock = arguments.count > 2 && arguments[2] == "unlock"

func reply(_ object: [String: Any]) {
  let data = try! JSONSerialization.data(withJSONObject: object)
  FileHandle.standardOutput.write(data)
  FileHandle.standardOutput.write("\n".data(using: .utf8)!)
}

/// Turns WebKit's 60fps preference off through its feature API (SPI).
func unlockFrameRate(_ prefs: WKPreferences) -> Bool {
  let featuresSel = NSSelectorFromString("_features")
  let setSel = NSSelectorFromString("_setEnabled:forFeature:")
  guard WKPreferences.responds(to: featuresSel), prefs.responds(to: setSel),
        let features = (WKPreferences.self as AnyObject).perform(featuresSel)?.takeUnretainedValue() as? [NSObject]
  else { return false }
  typealias SetEnabled = @convention(c) (AnyObject, Selector, Bool, AnyObject) -> Void
  let setEnabled = unsafeBitCast(prefs.method(for: setSel), to: SetEnabled.self)
  for feature in features where (feature.value(forKey: "key") as? String) == "PreferPageRenderingUpdatesNear60FPSEnabled" {
    setEnabled(prefs, setSel, false, feature)
    return true
  }
  return false
}

final class Driver: NSObject, WKNavigationDelegate {
  let window: NSWindow
  let web: WKWebView
  var activity: NSObjectProtocol?

  init(url: URL, unlock: Bool) {
    let config = WKWebViewConfiguration()
    if unlock && !unlockFrameRate(config.preferences) {
      FileHandle.standardError.write("wkdriver: this WebKit has no 60fps feature to turn off\n".data(using: .utf8)!)
    }
    let frame = NSRect(x: 0, y: 0, width: 1280, height: 800)
    web = WKWebView(frame: frame, configuration: config)
    window = NSWindow(contentRect: frame, styleMask: [.titled, .closable], backing: .buffered, defer: false)
    super.init()
    web.navigationDelegate = self
    window.contentView = web
    window.title = "wkdriver\(unlock ? " (unlocked)" : "")"
    window.center()
    // WebKit stops animation frames in a window that is covered or in an
    // app that is napping: float above other apps' windows and keep awake,
    // so using the Mac during a run does not stall it.
    window.level = .floating
    activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .latencyCritical], reason: "benchmark")
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
    web.load(URLRequest(url: url))
  }

  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
    // The page's own WebContent process, for memory readings (SPI).
    reply(["ready": true, "pid": (webView.value(forKey: "_webProcessIdentifier") as? Int) ?? -1])
    // Commands are read off the main thread and run on it, one at a time.
    Thread.detachNewThread {
      while let line = readLine() {
        if line.hasPrefix("snapshot ") {
          let path = String(line.dropFirst("snapshot ".count))
          let done = DispatchSemaphore(value: 0)
          DispatchQueue.main.async {
            self.web.takeSnapshot(with: nil) { image, error in
              if let image, let tiff = image.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
                 let png = rep.representation(using: .png, properties: [:]) {
                try? png.write(to: URL(fileURLWithPath: path))
                reply(["value": path])
              }
              else {
                reply(["error": "\(String(describing: error))"])
              }
              done.signal()
            }
          }
          done.wait()
          continue
        }
        if line == "purge" {
          let done = DispatchSemaphore(value: 0)
          DispatchQueue.main.async {
            WKWebsiteDataStore.default().removeData(ofTypes: [WKWebsiteDataTypeMemoryCache], modifiedSince: .distantPast) {
              reply(["value": NSNull()])
              done.signal()
            }
          }
          done.wait()
          continue
        }
        guard let data = line.data(using: .utf8),
              let js = try? JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed) as? String
        else { reply(["error": "bad command"]); continue }
        let done = DispatchSemaphore(value: 0)
        DispatchQueue.main.async {
          self.web.callAsyncJavaScript("return JSON.stringify(await (\(js)) ?? null)", arguments: [:], in: nil, in: .page) { result in
            switch result {
            case .success(let value):
              let text = value as? String ?? "null"
              let parsed = (try? JSONSerialization.jsonObject(with: text.data(using: .utf8)!, options: .fragmentsAllowed)) ?? NSNull()
              reply(["value": parsed])
            case .failure(let error):
              reply(["error": "\(error)"])
            }
            done.signal()
          }
        }
        done.wait()
      }
      exit(0)
    }
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let driver = Driver(url: url, unlock: unlock)
app.run()
