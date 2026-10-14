package main

import (
	"errors"
	"sync"
	"unsafe"

	"github.com/ebitengine/purego"
)

// Objective-C runtime bindings, for the calls mygo doesn't expose: trashing
// a file and learning where it went, so it can be put back, and the web
// view's frame rate (see webview_darwin.go).

type objcID = uintptr

var (
	objc struct {
		GetClass    func(name string) objcID
		RegisterSel func(name string) objcID
		PoolPush    func() uintptr
		PoolPop     func(uintptr)
		// objc_msgSend, typed once per call shape used below.
		Send      func(obj, sel objcID) objcID
		SendStr   func(obj, sel objcID, s string) objcID
		SendID    func(obj, sel, arg objcID) objcID
		SendTrash func(obj, sel, url objcID, result, nserr *objcID) bool
		SendBool  func(obj, sel, arg objcID) bool
		SendIndex func(obj, sel objcID, i uint) objcID
		SendCount func(obj, sel objcID) uint
		SendFlag  func(obj, sel objcID, flag bool, arg objcID)
	}
	objcOnce sync.Once
	objcErr  error
)

func loadObjC() error {
	objcOnce.Do(func() {
		lib, err := purego.Dlopen("/usr/lib/libobjc.A.dylib", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			objcErr = err
			return
		}
		// Foundation must be loaded for its classes to resolve.
		if _, err := purego.Dlopen("/System/Library/Frameworks/Foundation.framework/Foundation", purego.RTLD_NOW|purego.RTLD_GLOBAL); err != nil {
			objcErr = err
			return
		}
		purego.RegisterLibFunc(&objc.GetClass, lib, "objc_getClass")
		purego.RegisterLibFunc(&objc.RegisterSel, lib, "sel_registerName")
		purego.RegisterLibFunc(&objc.PoolPush, lib, "objc_autoreleasePoolPush")
		purego.RegisterLibFunc(&objc.PoolPop, lib, "objc_autoreleasePoolPop")
		purego.RegisterLibFunc(&objc.Send, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.SendStr, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.SendID, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.SendTrash, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.SendBool, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.SendIndex, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.SendCount, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.SendFlag, lib, "objc_msgSend")
	})
	return objcErr
}

// goString copies a NUL-terminated C string.
func goString(c uintptr) string {
	if c == 0 {
		return ""
	}
	p := *(*unsafe.Pointer)(unsafe.Pointer(&c))
	n := 0
	for *(*byte)(unsafe.Add(p, n)) != 0 {
		n++
	}
	return string(unsafe.Slice((*byte)(p), n))
}

// nsStringValue reads an NSString as a Go string.
func nsStringValue(s objcID) string {
	if s == 0 {
		return ""
	}
	return goString(objc.Send(s, objc.RegisterSel("UTF8String")))
}

// trashItem moves path to the trash, like Finder's "Move to Trash", and
// returns where it ended up there.
func trashItem(path string) (string, error) {
	if err := loadObjC(); err != nil {
		return "", err
	}
	pool := objc.PoolPush()
	defer objc.PoolPop(pool)

	sel := objc.RegisterSel
	nsPath := objc.SendStr(objc.GetClass("NSString"), sel("stringWithUTF8String:"), path)
	url := objc.SendID(objc.GetClass("NSURL"), sel("fileURLWithPath:"), nsPath)
	fm := objc.Send(objc.GetClass("NSFileManager"), sel("defaultManager"))
	var result, nserr objcID
	if !objc.SendTrash(fm, sel("trashItemAtURL:resultingItemURL:error:"), url, &result, &nserr) {
		if nserr != 0 {
			return "", errors.New(nsStringValue(objc.Send(nserr, sel("localizedDescription"))))
		}
		return "", errors.New("无法移到废纸篓")
	}
	return nsStringValue(objc.Send(result, sel("path"))), nil
}
