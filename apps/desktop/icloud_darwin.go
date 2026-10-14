package main

import (
	"runtime"
	"sync"
	"unsafe"

	"github.com/ebitengine/purego"
)

var (
	ubiquity struct {
		// -[NSURL getResourceValue:forKey:error:] and -[NSNumber boolValue].
		SendGetResource func(obj, sel objcID, value *objcID, key objcID, nserr *objcID) bool
		SendIsTrue      func(obj, sel objcID) bool
		isUbiquitousKey objcID
	}
	ubiquityOnce sync.Once
	ubiquityErr  error
)

func loadUbiquity() error {
	ubiquityOnce.Do(func() {
		if ubiquityErr = loadObjC(); ubiquityErr != nil {
			return
		}
		lib, err := purego.Dlopen("/usr/lib/libobjc.A.dylib", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			ubiquityErr = err
			return
		}
		foundation, err := purego.Dlopen("/System/Library/Frameworks/Foundation.framework/Foundation", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			ubiquityErr = err
			return
		}
		addr, err := purego.Dlsym(foundation, "NSURLIsUbiquitousItemKey")
		if err != nil {
			ubiquityErr = err
			return
		}
		ubiquity.isUbiquitousKey = **(**objcID)(unsafe.Pointer(&addr)) // addr points at a C global
		purego.RegisterLibFunc(&ubiquity.SendGetResource, lib, "objc_msgSend")
		purego.RegisterLibFunc(&ubiquity.SendIsTrue, lib, "objc_msgSend")
	})
	return ubiquityErr
}

// isICloudItem reports whether path lives in iCloud Drive, which includes a
// Desktop or Documents folder synced to it, as Finder sees it.
func isICloudItem(path string) bool {
	if loadUbiquity() != nil {
		return false
	}
	// An autorelease pool belongs to a thread: pop it on the one it was
	// pushed on.
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	pool := objc.PoolPush()
	defer objc.PoolPop(pool)

	sel := objc.RegisterSel
	nsPath := objc.SendStr(objc.GetClass("NSString"), sel("stringWithUTF8String:"), path)
	url := objc.SendID(objc.GetClass("NSURL"), sel("fileURLWithPath:"), nsPath)
	var value, nserr objcID
	if !ubiquity.SendGetResource(url, sel("getResourceValue:forKey:error:"), &value, ubiquity.isUbiquitousKey, &nserr) || value == 0 {
		return false
	}
	return ubiquity.SendIsTrue(value, sel("boolValue"))
}
