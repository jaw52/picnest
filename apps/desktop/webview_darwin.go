package main

import "log"

// WebKit's preference that holds page rendering near 60fps.
const near60FPSFeature = "PreferPageRenderingUpdatesNear60FPSEnabled"

// unlockFrameRate lets the web view in nsWindow render at the display's
// refresh rate. WebKit holds pages near 60fps by default, so on a 120Hz
// display the grid scrolled at half the rate of native apps. The flag is
// set through WebKit's feature API, the one Safari's Feature Flags menu
// uses; a WebKit without it is left as it is.
func unlockFrameRate(nsWindow uintptr) {
	if err := loadObjC(); err != nil {
		log.Printf("frame rate left capped: %v", err)
		return
	}
	sel := objc.RegisterSel
	web := findWebView(objc.Send(nsWindow, sel("contentView")))
	prefsClass := objc.GetClass("WKPreferences")
	if web == 0 || !objc.SendBool(prefsClass, sel("respondsToSelector:"), sel("_features")) {
		return
	}
	prefs := objc.Send(objc.Send(web, sel("configuration")), sel("preferences"))
	features := objc.Send(prefsClass, sel("_features"))
	for i := range objc.SendCount(features, sel("count")) {
		feature := objc.SendIndex(features, sel("objectAtIndex:"), i)
		if goString(objc.Send(objc.Send(feature, sel("key")), sel("UTF8String"))) == near60FPSFeature {
			objc.SendFlag(prefs, sel("_setEnabled:forFeature:"), false, feature)
			return
		}
	}
}

// findWebView returns the WKWebView in view's hierarchy, or 0.
func findWebView(view objcID) objcID {
	if view == 0 {
		return 0
	}
	sel := objc.RegisterSel
	if objc.SendBool(view, sel("isKindOfClass:"), objc.GetClass("WKWebView")) {
		return view
	}
	subviews := objc.Send(view, sel("subviews"))
	for i := range objc.SendCount(subviews, sel("count")) {
		if web := findWebView(objc.SendIndex(subviews, sel("objectAtIndex:"), i)); web != 0 {
			return web
		}
	}
	return 0
}
