// Exports the Mac's Photos library for the benchmark to run on real
// pictures, through PhotoKit as Picnest reads it. Usage:
//
//   export-photos <out dir> [count] [previews]
//
// Writes, for the `count` newest pictures (default 1000), <out>/t/<i>.jpg
// thumbnails of THUMB_EDGE px and, for the first `previews` (default 200:
// the preview scenarios reach the first hundred or so), <out>/f/<i>.jpg at
// the screen's size; and <out>/manifest.json with each picture's width and
// height. Only pictures already on this Mac are read (nothing is downloaded
// from iCloud); those that are not are skipped. Nothing else is written: no
// file names, dates or places.
//
// The library is only ever read: nothing here changes, adds or deletes a
// picture (that would take PHPhotoLibrary.performChanges). Delete <out> to
// get rid of the copies.

import AppKit
import Photos
import UniformTypeIdentifiers

let THUMB_EDGE: CGFloat = 512

let arguments = CommandLine.arguments
guard arguments.count >= 2 else {
  print("usage: export-photos <out dir> [count] [previews]")
  exit(2)
}
let out = URL(fileURLWithPath: arguments[1])
let count = arguments.count > 2 ? Int(arguments[2])! : 1000
let previewCount = arguments.count > 3 ? Int(arguments[3])! : 200
// As Picnest sizes its previews: the screen's longest side, in pixels.
let screen = NSScreen.main!
let previewEdge = max(screen.frame.width, screen.frame.height) * screen.backingScaleFactor

func writeJPEG(_ image: NSImage, to url: URL) -> Bool {
  guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil),
        let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil)
  else { return false }
  CGImageDestinationAddImage(dest, cg, [kCGImageDestinationLossyCompressionQuality: 0.82] as CFDictionary)
  return CGImageDestinationFinalize(dest)
}

func image(of asset: PHAsset, edge: CGFloat) -> NSImage? {
  let options = PHImageRequestOptions()
  options.isSynchronous = true
  options.deliveryMode = .highQualityFormat
  options.resizeMode = .exact
  options.isNetworkAccessAllowed = false
  let scale = min(edge / CGFloat(max(asset.pixelWidth, asset.pixelHeight)), 1)
  let size = CGSize(width: CGFloat(asset.pixelWidth) * scale, height: CGFloat(asset.pixelHeight) * scale)
  var result: NSImage?
  PHImageManager.default().requestImage(for: asset, targetSize: size, contentMode: .aspectFit, options: options) { image, _ in
    result = image
  }
  return result
}

let semaphore = DispatchSemaphore(value: 0)
PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in semaphore.signal() }
semaphore.wait()
let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
guard status == .authorized || status == .limited else {
  print("Photos access not granted (status \(status.rawValue))")
  exit(1)
}

let fetch = PHFetchOptions()
fetch.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
fetch.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
fetch.fetchLimit = count
let assets = PHAsset.fetchAssets(with: fetch)
print("library: \(assets.count) pictures to export (previews at \(Int(previewEdge))px for the first \(previewCount))")

try FileManager.default.createDirectory(at: out.appendingPathComponent("t"), withIntermediateDirectories: true)
try FileManager.default.createDirectory(at: out.appendingPathComponent("f"), withIntermediateDirectories: true)

// Each slot is the exported picture's size, or nil if it is not on this Mac.
var sizes = [[Int]?](repeating: nil, count: assets.count)
let lock = NSLock()
var done = 0
DispatchQueue.concurrentPerform(iterations: assets.count) { i in
  let asset = assets.object(at: i)
  guard let thumb = image(of: asset, edge: THUMB_EDGE),
        writeJPEG(thumb, to: out.appendingPathComponent("t/\(i).jpg"))
  else { return }
  if i < previewCount, let full = image(of: asset, edge: previewEdge) {
    _ = writeJPEG(full, to: out.appendingPathComponent("f/\(i).jpg"))
  }
  lock.lock()
  sizes[i] = [asset.pixelWidth, asset.pixelHeight]
  done += 1
  if done % 500 == 0 { print("  \(done)") }
  lock.unlock()
}

// Renumbers the exported copies in <out> 0..n-1 so the benchmark can index
// them.
var manifest: [[String: Any]] = []
for (i, size) in sizes.enumerated() {
  guard let size else { continue }
  let n = manifest.count
  let fm = FileManager.default
  if n != i {
    try fm.moveItem(at: out.appendingPathComponent("t/\(i).jpg"), to: out.appendingPathComponent("t/\(n).jpg"))
    if fm.fileExists(atPath: out.appendingPathComponent("f/\(i).jpg").path) {
      try fm.moveItem(at: out.appendingPathComponent("f/\(i).jpg"), to: out.appendingPathComponent("f/\(n).jpg"))
    }
  }
  manifest.append([
    "w": size[0],
    "h": size[1],
    "full": fm.fileExists(atPath: out.appendingPathComponent("f/\(n).jpg").path),
  ])
}
let data = try JSONSerialization.data(withJSONObject: manifest)
try data.write(to: out.appendingPathComponent("manifest.json"))
print("exported \(manifest.count) of \(assets.count) (\(assets.count - manifest.count) not on this Mac)")
