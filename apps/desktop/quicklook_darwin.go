package main

import (
	"errors"
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"github.com/ebitengine/purego"
	pobjc "github.com/ebitengine/purego/objc"
)

// QuickLook thumbnails for undownloaded iCloud Drive files. iCloud keeps a
// thumbnail of every file in the cloud and QuickLook serves it without
// downloading the file, which is how Finder shows these files.

// qlRepresentationThumbnail asks only for a real thumbnail, never the file
// type's icon (QLThumbnailGenerationRequestRepresentationTypeThumbnail).
const qlRepresentationThumbnail = 1 << 2

// quickLookTimeout bounds a request iCloud is slow to answer.
const quickLookTimeout = 10 * time.Second

var (
	ql struct {
		// The CGSize argument is two doubles, which arm64 passes in the same
		// registers as two separate double arguments.
		SendInit func(obj, sel, url objcID, width, height, scale float64, types uint) objcID
		SendID2  func(obj, sel, a, b objcID)
	}
	qlOnce sync.Once
	qlErr  error
)

func loadQuickLook() error {
	qlOnce.Do(func() {
		if qlErr = loadObjC(); qlErr != nil {
			return
		}
		if qlErr = loadFrameworks(); qlErr != nil {
			return
		}
		if _, qlErr = purego.Dlopen("/System/Library/Frameworks/QuickLookThumbnailing.framework/QuickLookThumbnailing", purego.RTLD_NOW|purego.RTLD_GLOBAL); qlErr != nil {
			return
		}
		lib, err := purego.Dlopen("/usr/lib/libobjc.A.dylib", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			qlErr = err
			return
		}
		purego.RegisterLibFunc(&ql.SendInit, lib, "objc_msgSend")
		purego.RegisterLibFunc(&ql.SendID2, lib, "objc_msgSend")
	})
	return qlErr
}

// withQuickLookThumbnail fetches the QuickLook thumbnail of path, at most
// maxEdge px, and passes its CGImage to use. The image is only valid during
// use, which runs on a QuickLook thread.
func withQuickLookThumbnail(path string, maxEdge int, use func(img cfRef) error) error {
	if err := loadQuickLook(); err != nil {
		return err
	}
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	pool := objc.PoolPush()
	defer objc.PoolPop(pool)

	sel := objc.RegisterSel
	nsPath := objc.SendStr(objc.GetClass("NSString"), sel("stringWithUTF8String:"), path)
	url := objc.SendID(objc.GetClass("NSURL"), sel("fileURLWithPath:"), nsPath)
	req := objc.Send(objc.GetClass("QLThumbnailGenerationRequest"), sel("alloc"))
	edge := float64(maxEdge)
	req = ql.SendInit(req, sel("initWithFileAtURL:size:scale:representationTypes:"), url, edge, edge, 1, qlRepresentationThumbnail)
	if req == 0 {
		return errors.New("failed to create thumbnail request")
	}
	defer objc.Send(req, sel("release"))

	done := make(chan error, 1)
	var abandoned atomic.Bool
	block := pobjc.NewBlock(func(_ pobjc.Block, rep, _ pobjc.ID) {
		if abandoned.Load() {
			return
		}
		if rep == 0 {
			done <- errors.New("no cloud thumbnail")
			return
		}
		img := objc.Send(objcID(rep), sel("CGImage"))
		if img == 0 {
			done <- errors.New("no cloud thumbnail")
			return
		}
		done <- use(img)
	})
	// The generator copies the block; this reference is ours alone.
	defer block.Release()

	gen := objc.Send(objc.GetClass("QLThumbnailGenerator"), sel("sharedGenerator"))
	ql.SendID2(gen, sel("generateBestRepresentationForRequest:completionHandler:"), req, objcID(block))
	select {
	case err := <-done:
		return err
	case <-time.After(quickLookTimeout):
		abandoned.Store(true)
		objc.SendID(gen, sel("cancelRequest:"), req)
		return errors.New("cloud thumbnail timed out")
	}
}

// writeCloudThumbnail writes path's QuickLook thumbnail to dst as a JPEG.
func writeCloudThumbnail(src, dst string, maxEdge int, quality float64) error {
	return withQuickLookThumbnail(src, maxEdge, func(img cfRef) error {
		return writeJPEG(img, dst, quality)
	})
}

// cloudThumbnailSize reports the size of path's QuickLook thumbnail, which
// has the photo's aspect ratio.
func cloudThumbnailSize(path string) (int, int, error) {
	var w, h int
	err := withQuickLookThumbnail(path, cloudAspectEdge, func(img cfRef) error {
		w, h = imgio.ImageGetWidth(img), imgio.ImageGetHeight(img)
		return nil
	})
	return w, h, err
}

// cloudAspectEdge is the thumbnail size fetched just for its aspect ratio.
const cloudAspectEdge = 256
