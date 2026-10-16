package main

import (
	"cmp"
	"log"
	"net/url"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/ebitengine/purego"
	pobjc "github.com/ebitengine/purego/objc"
	"github.com/egoist/mygo"
)

// The menu bar end of collecting: an icon that takes pictures dragged onto
// it, and opens a panel under it as one is dragged over - which takes them
// too, and lists what was dropped. mygo's tray icon and flyout make the two;
// taking drags is AppKit's, added here.

const (
	// collectPanelWidth and collectPanelHeight size the panel, in points.
	collectPanelWidth  = 300
	collectPanelHeight = 360
	// collectLinger is how long the panel stays once a drag leaves it, or
	// after a drop, before closing on its own.
	collectLinger = 2500 * time.Millisecond
	// nsDragOperationCopy is the drag operation a drop target accepts.
	nsDragOperationCopy = 1
	// nsViewSizable makes a view follow its superview's size.
	nsViewSizable = 2 | 16
	// NSTrackingAreaOptions.
	nsTrackingMouseEnteredAndExited = 0x01
	nsTrackingMouseMoved            = 0x02
	nsTrackingActiveAlways          = 0x80
	nsTrackingInVisibleRect         = 0x200
)

// collectHover tells the panel a picture is dragged over it.
var collectHover = mygo.NewEvent[bool]("collect-hover")

// dragTypes are the pasteboard types read from a drop, as browsers put a
// dragged picture there: its address (or a link's), its markup (Chromium
// keeps a picture's apart), the page (Chromium; WebKit's web archive holds
// it, the markup and the picture's address), a local file, or the picture
// itself.
var dragTypes = []string{
	"public.url", "public.html", "org.chromium.image-html", "org.chromium.source-url", "com.apple.webarchive", "public.file-url",
	"public.png", "public.jpeg", "public.tiff", "com.compuserve.gif", "org.webmproject.webp",
}

type nsRect struct{ X, Y, W, H float64 }

var collectUI struct {
	// mu guards the fields below. They change on the main thread - where
	// AppKit calls the drop targets and mygo the icon's clicks, and where
	// closing timers move to - so its holders never wait on that thread.
	mu    sync.Mutex
	panel *mygo.Window
	// overlay covers the panel's page while a drag is over the icon or the
	// panel, so the drop comes here rather than to the page.
	overlay pobjc.ID
	// pinned keeps the panel open until the icon is clicked again: it was
	// opened by a click, not a drag.
	pinned bool
	// closing is the pending close, stopped if a drag comes back.
	closing *time.Timer
}

var objcSetClass func(obj pobjc.ID, class pobjc.Class) pobjc.Class

// setupCollector adds the menu bar icon and its panel.
func setupCollector() {
	tray, err := mygo.NewTray(mygo.TrayOptions{ToolTip: text().collectTip})
	if err != nil {
		log.Printf("collecting off: %v", err)
		return
	}
	panel := mygo.NewFlyout(mygo.FlyoutOptions{
		Tray:      tray,
		Placement: mygo.PlacementBottom,
		Gap:       4,
		Width:     collectPanelWidth,
		Height:    collectPanelHeight,
		Shadow:    true,
		Hidden:    true,
		URL:       "/#collect",
	})
	collectUI.panel = panel
	collected.onChange = func(items []CollectItem) {
		if err := collectChanged.Emit(panel, items); err != nil {
			log.Printf("failed to update the collect panel: %v", err)
		}
	}
	tray.OnClick(func() {
		collectUI.mu.Lock()
		defer collectUI.mu.Unlock()
		stopClosing()
		if panel.IsVisible() && collectUI.pinned {
			collectUI.pinned = false
			panel.Hide()
			return
		}
		collectUI.pinned = true
		showPanel()
	})

	mygo.RunOnMain(func() {
		if err := installDropTargets(tray, panel); err != nil {
			log.Printf("collecting by drag off: %v", err)
		}
	})
}

// installDropTargets makes the icon's button, and an overlay on the panel,
// take dragged pictures. Main thread only.
func installDropTargets(tray *mygo.Tray, panel *mygo.Window) error {
	lib, err := purego.Dlopen("/usr/lib/libobjc.A.dylib", purego.RTLD_NOW|purego.RTLD_GLOBAL)
	if err != nil {
		return err
	}
	purego.RegisterLibFunc(&objcSetClass, lib, "object_setClass")
	if err := loadFrameworks(); err != nil {
		return err
	}
	if err := loadObjC(); err != nil {
		return err
	}
	sel := pobjc.RegisterName

	button := statusButton(tray)
	if button == 0 {
		return errNoStatusButton
	}
	symbol := nsStr("tray.and.arrow.down.fill")
	image := pobjc.ID(pobjc.GetClass("NSImage")).Send(sel("imageWithSystemSymbolName:accessibilityDescription:"), symbol, nsStr(text().collectTip))
	image.Send(sel("setTemplate:"), true)
	button.Send(sel("setImage:"), image)

	// The button becomes an instance of a subclass of its own class that
	// takes drags; nothing else about it changes.
	buttonClass, err := pobjc.RegisterClass("PicnestStatusButton", button.Class(), nil, nil, dropMethods(dropOnIcon))
	if err != nil {
		return err
	}
	objcSetClass(button, buttonClass)
	button.Send(sel("registerForDraggedTypes:"), nsStringArray(dragTypes))

	// The overlay lets clicks through to the page: AppKit finds drop
	// targets by the dragged types views take, not by hit testing. The
	// NSPoint argument is two doubles, passed as two separate ones are.
	passClicks := pobjc.MethodDef{Cmd: sel("hitTest:"), Fn: func(_ pobjc.ID, _ pobjc.SEL, _, _ float64) pobjc.ID { return 0 }}
	content := pobjc.ID(panel.NativeHandle()).Send(sel("contentView"))
	webView := pobjc.ID(findWebView(objcID(content)))
	overlayClass, err := pobjc.RegisterClass("PicnestDropOverlay", pobjc.GetClass("NSView"), nil, nil,
		append(append(dropMethods(dropOnPanel), passClicks), forwardMouseMoves(webView)...))
	if err != nil {
		return err
	}
	bounds := pobjc.Send[nsRect](content, sel("bounds"))
	overlay := pobjc.ID(overlayClass).Send(sel("alloc")).Send(sel("initWithFrame:"), bounds)
	overlay.Send(sel("setAutoresizingMask:"), uint(nsViewSizable))
	overlay.Send(sel("registerForDraggedTypes:"), nsStringArray(dragTypes))
	content.Send(sel("addSubview:"), overlay)
	if webView != 0 {
		tracking := pobjc.ID(pobjc.GetClass("NSTrackingArea")).Send(sel("alloc")).Send(sel("initWithRect:options:owner:userInfo:"),
			nsRect{}, uint(nsTrackingMouseEnteredAndExited|nsTrackingMouseMoved|nsTrackingActiveAlways|nsTrackingInVisibleRect), overlay, pobjc.ID(0))
		overlay.Send(sel("addTrackingArea:"), tracking)
	}
	collectUI.overlay = overlay
	return nil
}

// forwardMouseMoves passes the pointer's moves over the panel to its page
// while the app is in the background. The panel opens without activating
// the app, and a web view hears moves only in an active app, so the page's
// hover states - a menu's highlight following the pointer - would stand
// still.
func forwardMouseMoves(webView pobjc.ID) []pobjc.MethodDef {
	if webView == 0 {
		return nil
	}
	sel := pobjc.RegisterName
	app := pobjc.ID(pobjc.GetClass("NSApplication")).Send(sel("sharedApplication"))
	forward := func(_ pobjc.ID, cmd pobjc.SEL, ev pobjc.ID) {
		if !pobjc.Send[bool](app, sel("isActive")) {
			webView.Send(cmd, ev)
		}
	}
	return []pobjc.MethodDef{
		{Cmd: sel("mouseMoved:"), Fn: forward},
		{Cmd: sel("mouseEntered:"), Fn: forward},
		{Cmd: sel("mouseExited:"), Fn: forward},
	}
}

type dropSite int

const (
	dropOnIcon dropSite = iota
	dropOnPanel
)

// dropMethods are the NSDraggingDestination methods of a drop target at site.
func dropMethods(site dropSite) []pobjc.MethodDef {
	sel := pobjc.RegisterName
	return []pobjc.MethodDef{
		{Cmd: sel("draggingEntered:"), Fn: func(_ pobjc.ID, _ pobjc.SEL, _ pobjc.ID) uint {
			dragEntered(site)
			return nsDragOperationCopy
		}},
		{Cmd: sel("draggingUpdated:"), Fn: func(_ pobjc.ID, _ pobjc.SEL, _ pobjc.ID) uint {
			return nsDragOperationCopy
		}},
		{Cmd: sel("draggingExited:"), Fn: func(_ pobjc.ID, _ pobjc.SEL, _ pobjc.ID) {
			dragExited(site)
		}},
		{Cmd: sel("prepareForDragOperation:"), Fn: func(_ pobjc.ID, _ pobjc.SEL, _ pobjc.ID) bool {
			return true
		}},
		{Cmd: sel("performDragOperation:"), Fn: func(_ pobjc.ID, _ pobjc.SEL, info pobjc.ID) bool {
			drop := readDrop(info.Send(sel("draggingPasteboard")))
			dropped(site)
			collected.collect(drop)
			return true
		}},
	}
}

// dragEntered opens the panel as a picture is dragged over the icon, and
// covers its page so the panel takes the drop.
func dragEntered(site dropSite) {
	collectUI.mu.Lock()
	defer collectUI.mu.Unlock()
	stopClosing()
	if site == dropOnIcon {
		showPanel()
		return
	}
	emitHover(true)
}

func dragExited(site dropSite) {
	collectUI.mu.Lock()
	defer collectUI.mu.Unlock()
	if site == dropOnPanel {
		emitHover(false)
	}
	closeLater()
}

func dropped(site dropSite) {
	collectUI.mu.Lock()
	defer collectUI.mu.Unlock()
	if site == dropOnIcon {
		showPanel()
	}
	emitHover(false)
	closeLater()
}

// showPanel shows the panel under the icon, placing it again first: the
// icon moves as others come and go in the menu bar. Main thread only.
func showPanel() {
	collectUI.panel.SetSize(collectPanelWidth, collectPanelHeight)
	collectUI.panel.ShowInactive()
}

func emitHover(over bool) {
	if err := collectHover.Emit(collectUI.panel, over); err != nil {
		log.Printf("failed to update the collect panel: %v", err)
	}
}

// closeLater closes the panel after collectLinger, unless a click opened
// it or a drag comes back first. Holds collectUI.mu.
func closeLater() {
	stopClosing()
	if collectUI.pinned {
		hideOverlay()
		return
	}
	var timer *time.Timer
	timer = time.AfterFunc(collectLinger, func() {
		// On the main thread, which holds the lock only briefly, so this
		// waits on no one who waits on it.
		mygo.RunOnMain(func() {
			collectUI.mu.Lock()
			defer collectUI.mu.Unlock()
			if collectUI.closing != timer {
				return
			}
			collectUI.closing = nil
			hideOverlay()
			collectUI.panel.Hide()
		})
	})
	collectUI.closing = timer
}

// stopClosing cancels a pending close. Holds collectUI.mu.
func stopClosing() {
	if collectUI.closing != nil {
		collectUI.closing.Stop()
		collectUI.closing = nil
	}
}

// hideOverlay uncovers the panel's page. Main thread only.
func hideOverlay() {}

// readDrop reads a dragged picture off the drag's pasteboard.
func readDrop(pb pobjc.ID) droppedImage {
	sel := pobjc.RegisterName
	read := func(uti string) string {
		return goStringFromNS(pb.Send(sel("stringForType:"), nsStr(uti)))
	}
	drop := droppedImage{
		URL:       read("public.url"),
		HTML:      cmp.Or(read("public.html"), read("org.chromium.image-html")),
		SourceURL: read("org.chromium.source-url"),
	}
	readWebArchive(pb, &drop)
	if u, err := url.Parse(read("public.file-url")); err == nil && u.Scheme == "file" {
		drop.File = u.Path
	}
	for _, uti := range []string{"public.png", "public.jpeg", "com.compuserve.gif", "org.webmproject.webp", "public.tiff"} {
		data := pb.Send(sel("dataForType:"), nsStr(uti))
		if data == 0 {
			continue
		}
		if bytes := nsDataBytes(data); len(bytes) > 0 {
			drop.Data, drop.DataType = bytes, uti
			break
		}
	}
	log.Printf("collect: dropped %v; url=%q source=%q image=%q file=%q data=%s(%d bytes)",
		pasteboardTypes(pb), drop.URL, drop.SourceURL, drop.ArchivedImageURL, drop.File, drop.DataType, len(drop.Data))
	return drop
}

// readWebArchive fills in what WebKit (Safari, and web views) leaves out of
// a drag but keeps in its web archive of it: the page the drag started on,
// the dragged markup, and the address of the picture in it.
func readWebArchive(pb pobjc.ID, drop *droppedImage) {
	sel := pobjc.RegisterName
	data := pb.Send(sel("dataForType:"), nsStr("com.apple.webarchive"))
	if data == 0 {
		return
	}
	archive := pobjc.ID(pobjc.GetClass("NSPropertyListSerialization")).Send(
		sel("propertyListWithData:options:format:error:"), data, uint(0), uintptr(0), uintptr(0))
	if archive == 0 {
		return
	}
	str := func(dict pobjc.ID, key string) string {
		return goStringFromNS(dict.Send(sel("objectForKey:"), nsStr(key)))
	}
	main := archive.Send(sel("objectForKey:"), nsStr("WebMainResource"))
	if main != 0 {
		if drop.SourceURL == "" {
			drop.SourceURL = str(main, "WebResourceURL")
		}
		if markup := main.Send(sel("objectForKey:"), nsStr("WebResourceData")); drop.HTML == "" && markup != 0 {
			drop.HTML = string(nsDataBytes(markup))
		}
	}
	subresources := archive.Send(sel("objectForKey:"), nsStr("WebSubresources"))
	for i := range pobjc.Send[uint](subresources, sel("count")) {
		r := subresources.Send(sel("objectAtIndex:"), i)
		if strings.HasPrefix(str(r, "WebResourceMIMEType"), "image/") {
			drop.ArchivedImageURL = str(r, "WebResourceURL")
			return
		}
	}
}

// nsDataBytes copies an NSData's bytes.
func nsDataBytes(data pobjc.ID) []byte {
	sel := pobjc.RegisterName
	n := pobjc.Send[uint](data, sel("length"))
	p := pobjc.Send[uintptr](data, sel("bytes"))
	if n == 0 || p == 0 {
		return nil
	}
	// p points at memory the NSData owns, not Go's.
	return append([]byte(nil), unsafe.Slice((*byte)(*(*unsafe.Pointer)(unsafe.Pointer(&p))), n)...)
}

func pasteboardTypes(pb pobjc.ID) []string {
	sel := pobjc.RegisterName
	types := pb.Send(sel("types"))
	var out []string
	for i := range pobjc.Send[uint](types, sel("count")) {
		out = append(out, goStringFromNS(types.Send(sel("objectAtIndex:"), i)))
	}
	return out
}

// statusButton finds the button of tray's icon: the content of the status
// bar window at the icon's place. Main thread only.
func statusButton(tray *mygo.Tray) pobjc.ID {
	sel := pobjc.RegisterName
	app := pobjc.ID(pobjc.GetClass("NSApplication")).Send(sel("sharedApplication"))
	windows := app.Send(sel("windows"))
	barClass := pobjc.GetClass("NSStatusBarWindow")
	for i := range pobjc.Send[uint](windows, sel("count")) {
		w := windows.Send(sel("objectAtIndex:"), i)
		if barClass == 0 || !pobjc.Send[bool](w, sel("isKindOfClass:"), barClass) {
			continue
		}
		if b := findStatusBarButton(w.Send(sel("contentView"))); b != 0 {
			return b
		}
	}
	return 0
}

func findStatusBarButton(view pobjc.ID) pobjc.ID {
	sel := pobjc.RegisterName
	if view == 0 {
		return 0
	}
	if pobjc.Send[bool](view, sel("isKindOfClass:"), pobjc.GetClass("NSStatusBarButton")) {
		return view
	}
	subviews := view.Send(sel("subviews"))
	for i := range pobjc.Send[uint](subviews, sel("count")) {
		if b := findStatusBarButton(subviews.Send(sel("objectAtIndex:"), i)); b != 0 {
			return b
		}
	}
	return 0
}

// nsStr is nsString as purego's objc package types it.
func nsStr(s string) pobjc.ID { return pobjc.ID(nsString(s)) }

func nsStringArray(items []string) pobjc.ID {
	sel := pobjc.RegisterName
	arr := pobjc.ID(pobjc.GetClass("NSMutableArray")).Send(sel("array"))
	for _, s := range items {
		arr.Send(sel("addObject:"), nsStr(s))
	}
	return arr
}

func goStringFromNS(s pobjc.ID) string {
	if s == 0 {
		return ""
	}
	return goString(uintptr(s.Send(pobjc.RegisterName("UTF8String"))))
}

type collectError string

func (e collectError) Error() string { return string(e) }

const errNoStatusButton = collectError("the menu bar icon's button was not found")
