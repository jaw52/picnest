package main

import (
	"bytes"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
	"unsafe"

	"github.com/ebitengine/purego"
	pobjc "github.com/ebitengine/purego/objc"
)

// The Photos library, read through PhotoKit. It is shown like a folder: its
// path is libraryRoot, and each photo's path is libraryRoot followed by the
// asset's local identifier. Nothing here writes to the library.

const libraryRoot = "photos:"

func isLibraryPath(path string) bool {
	return strings.HasPrefix(path, libraryRoot)
}

func libraryAssetID(path string) string {
	return strings.TrimPrefix(path, libraryRoot)
}

// libraryDataDir holds the library's ratings and thumbnails, which have no
// folder of their own to sit in.
func libraryDataDir() string {
	base, err := os.UserConfigDir()
	if err != nil {
		base = os.TempDir()
	}
	return filepath.Join(base, "design.jaw.picnest", "photos-library")
}

const (
	phAccessLevelReadWrite        = 2
	phAssetMediaTypeImage         = 1
	phImageContentModeAspectFit   = 0
	phImageDeliveryHighQuality    = 1
	phImageResizeModeFast         = 1
	phAssetResourceTypePhoto      = 1
	phAuthorizationNotDetermined  = 0
	phAuthorizationRestricted     = 1
	phAuthorizationDenied         = 2
	phAuthorizationAuthorized     = 3
	phAuthorizationLimited        = 4
	libraryPreviewEdge            = 4096
	libraryAuthorizationWaitLimit = 10 * time.Minute
)

// LibraryAccess is what the app may do with the Photos library.
type LibraryAccess string

const (
	LibraryAccessUndetermined LibraryAccess = "undetermined"
	LibraryAccessGranted      LibraryAccess = "granted"
	LibraryAccessDenied       LibraryAccess = "denied"
)

func libraryAccessOf(status int) LibraryAccess {
	switch status {
	case phAuthorizationAuthorized, phAuthorizationLimited:
		return LibraryAccessGranted
	case phAuthorizationNotDetermined:
		return LibraryAccessUndetermined
	default:
		return LibraryAccessDenied
	}
}

var (
	pk struct {
		// objc_msgSend, typed once per call shape used below.
		SendInt      func(obj, sel objcID) int
		SendIntArg   func(obj, sel objcID, v int) int
		SendFloat    func(obj, sel objcID) float64
		SendSetBool  func(obj, sel objcID, v bool)
		SendSetInt   func(obj, sel objcID, v int)
		SendIntID    func(obj, sel objcID, a int, b objcID) objcID
		SendIDBool   func(obj, sel, a objcID, b bool) objcID
		SendID2      func(obj, sel, a, b objcID) objcID
		SendID3      func(obj, sel, a, b, c objcID) objcID
		RequestImage func(obj, sel, asset objcID, width, height float64, mode int, opts, handler objcID) int32
	}
	pkOnce sync.Once
	pkErr  error
)

func loadPhotoKit() error {
	pkOnce.Do(func() {
		if pkErr = loadObjC(); pkErr != nil {
			return
		}
		if pkErr = loadFrameworks(); pkErr != nil {
			return
		}
		for _, fw := range []string{"Photos", "AppKit"} {
			if _, pkErr = purego.Dlopen("/System/Library/Frameworks/"+fw+".framework/"+fw, purego.RTLD_NOW|purego.RTLD_GLOBAL); pkErr != nil {
				return
			}
		}
		lib, err := purego.Dlopen("/usr/lib/libobjc.A.dylib", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			pkErr = err
			return
		}
		purego.RegisterLibFunc(&pk.SendInt, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendIntArg, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendFloat, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendSetBool, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendSetInt, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendIntID, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendIDBool, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendID2, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendID3, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.RequestImage, lib, "objc_msgSend")
	})
	return pkErr
}

// withPool runs fn on one OS thread inside an autorelease pool, which
// belongs to the thread it was pushed on.
func withPool(fn func() error) error {
	if err := loadPhotoKit(); err != nil {
		return err
	}
	defer pushPool()()
	return fn()
}

func sel(name string) objcID { return objc.RegisterSel(name) }

func nsString(s string) objcID {
	return objc.SendStr(objc.GetClass("NSString"), sel("stringWithUTF8String:"), s)
}

func libraryStatus() int {
	return pk.SendIntArg(objc.GetClass("PHPhotoLibrary"), sel("authorizationStatusForAccessLevel:"), phAccessLevelReadWrite)
}

// currentLibraryAccess reports the access granted so far, without asking.
func currentLibraryAccess() (LibraryAccess, error) {
	var access LibraryAccess
	err := withPool(func() error {
		access = libraryAccessOf(libraryStatus())
		return nil
	})
	return access, err
}

// requestLibraryAccess asks for access the first time, which shows the
// system prompt, and reports the answer. Asked again, macOS doesn't prompt:
// the answer stands until changed in System Settings.
func requestLibraryAccess() (LibraryAccess, error) {
	done := make(chan int, 1)
	var block pobjc.Block
	err := withPool(func() error {
		block = pobjc.NewBlock(func(_ pobjc.Block, status int) { done <- status })
		pk.SendIntID(objc.GetClass("PHPhotoLibrary"), sel("requestAuthorizationForAccessLevel:handler:"), phAccessLevelReadWrite, objcID(block))
		return nil
	})
	if err != nil {
		return "", err
	}
	// PhotoKit copies the block; this reference is ours alone.
	defer block.Release()
	select {
	case status := <-done:
		return libraryAccessOf(status), nil
	case <-time.After(libraryAuthorizationWaitLimit):
		return LibraryAccessUndetermined, nil
	}
}

func requireLibraryAccess() error {
	if libraryAccessOf(libraryStatus()) != LibraryAccessGranted {
		return errors.New(text().libraryNoAccess)
	}
	return nil
}

// libraryPhotos holds the fetch the open library's pages come from, so the
// pages after the first don't each sort the whole library again. The first
// page fetches afresh, which is how a rescan sees new photos.
var libraryPhotos struct {
	sync.Mutex
	result objcID // retained
}

// libraryPhotosFrom returns the fetch for a page at offset, autoreleased
// into the caller's pool: a scan starting over meanwhile releases the shared
// one, which a scan still paging through it must outlive.
func libraryPhotosFrom(offset int) objcID {
	libraryPhotos.Lock()
	defer libraryPhotos.Unlock()
	if offset == 0 || libraryPhotos.result == 0 {
		if libraryPhotos.result != 0 {
			objc.Send(libraryPhotos.result, sel("release"))
		}
		libraryPhotos.result = objc.Send(fetchLibraryPhotos(), sel("retain"))
	}
	return objc.Send(objc.Send(libraryPhotos.result, sel("retain")), sel("autorelease"))
}

// fetchLibraryPhotos returns every photo in the library, newest first.
func fetchLibraryPhotos() objcID {
	opts := objc.Send(objc.Send(objc.GetClass("PHFetchOptions"), sel("alloc")), sel("init"))
	objc.Send(opts, sel("autorelease"))
	byDate := pk.SendIDBool(objc.GetClass("NSSortDescriptor"), sel("sortDescriptorWithKey:ascending:"), nsString("creationDate"), false)
	objc.SendID(opts, sel("setSortDescriptors:"), objc.SendID(objc.GetClass("NSArray"), sel("arrayWithObject:"), byDate))
	return pk.SendIntID(objc.GetClass("PHAsset"), sel("fetchAssetsWithMediaType:options:"), phAssetMediaTypeImage, opts)
}

func fetchLibraryAsset(id string) (objcID, error) {
	ids := objc.SendID(objc.GetClass("NSArray"), sel("arrayWithObject:"), nsString(id))
	result := pk.SendID2(objc.GetClass("PHAsset"), sel("fetchAssetsWithLocalIdentifiers:options:"), ids, 0)
	asset := objc.Send(result, sel("firstObject"))
	if asset == 0 {
		return 0, errors.New(text().libraryPhotoGone)
	}
	return asset, nil
}

func unixSeconds(date objcID) int64 {
	if date == 0 {
		return 0
	}
	return int64(pk.SendFloat(date, sel("timeIntervalSince1970")))
}

// assetFileName is the name the photo had when it was imported, e.g.
// IMG_0001.HEIC. The asset's originalFilename (undocumented; its filename is
// the library's own UUID name for the file) is read with the asset; its
// resources, the documented way, are a query per photo, which is left for an
// asset without one.
func assetFileName(asset objcID) string {
	if objc.SendBool(asset, sel("respondsToSelector:"), sel("originalFilename")) {
		if name := nsStringValue(objc.Send(asset, sel("originalFilename"))); name != "" {
			return name
		}
	}
	resources := objc.SendID(objc.GetClass("PHAssetResource"), sel("assetResourcesForAsset:"), asset)
	count := int(objc.SendCount(resources, sel("count")))
	name := ""
	for i := range count {
		res := objc.SendIndex(resources, sel("objectAtIndex:"), uint(i))
		typ := pk.SendInt(res, sel("type"))
		if name == "" || typ == phAssetResourceTypePhoto {
			name = nsStringValue(objc.Send(res, sel("originalFilename")))
		}
		if typ == phAssetResourceTypePhoto {
			break
		}
	}
	return name
}

// assetStamp is what a cached thumbnail of the asset depends on: an edit
// changes the modification date.
func assetStamp(asset objcID) int64 {
	return unixSeconds(objc.Send(asset, sel("modificationDate")))
}

func scanLibraryPage(offset, limit int) (PhotoPage, error) {
	db, err := openRatingsDB(libraryRoot)
	if err != nil {
		return PhotoPage{}, err
	}
	defer db.Close()
	ratings, err := getAllRatings(db)
	if err != nil {
		return PhotoPage{}, err
	}

	var page PhotoPage
	err = withPool(func() error {
		if err := requireLibraryAccess(); err != nil {
			return err
		}
		result := libraryPhotosFrom(offset)
		total := int(objc.SendCount(result, sel("count")))
		start := min(max(offset, 0), total)
		end := min(start+max(limit, 0), total)
		page = PhotoPage{Photos: make([]PhotoMeta, 0, end-start), Total: total}
		for i := start; i < end; i++ {
			// Each asset's own pool, so a large page doesn't pile up.
			pool := objc.PoolPush()
			asset := objc.SendIndex(result, sel("objectAtIndex:"), uint(i))
			id := nsStringValue(objc.Send(asset, sel("localIdentifier")))
			// FileName is left out: reading it is a query of Photos' own,
			// which for a library of 10,000 took 11s of the 12s its pages
			// took. The photos shown ask for theirs (libraryFileNames).
			page.Photos = append(page.Photos, PhotoMeta{
				Path:     libraryRoot + id,
				Width:    pk.SendInt(asset, sel("pixelWidth")),
				Height:   pk.SendInt(asset, sel("pixelHeight")),
				Rating:   ratings[id],
				Modified: assetStamp(asset),
			})
			objc.PoolPop(pool)
		}
		return nil
	})
	return page, err
}

// libraryFileNames returns the names the photos at paths had when imported,
// by path, leaving out photos no longer in the library.
func libraryFileNames(paths []string) (map[string]string, error) {
	names := make(map[string]string, len(paths))
	err := withPool(func() error {
		if err := requireLibraryAccess(); err != nil {
			return err
		}
		ids := objc.Send(objc.GetClass("NSMutableArray"), sel("array"))
		for _, path := range paths {
			objc.SendID(ids, sel("addObject:"), nsString(libraryAssetID(path)))
		}
		result := pk.SendID2(objc.GetClass("PHAsset"), sel("fetchAssetsWithLocalIdentifiers:options:"), ids, 0)
		for i := range int(objc.SendCount(result, sel("count"))) {
			pool := objc.PoolPush()
			asset := objc.SendIndex(result, sel("objectAtIndex:"), uint(i))
			names[libraryRoot+nsStringValue(objc.Send(asset, sel("localIdentifier")))] = assetFileName(asset)
			objc.PoolPop(pool)
		}
		return nil
	})
	return names, err
}

func newImageRequestOptions() objcID {
	opts := objc.Send(objc.Send(objc.GetClass("PHImageRequestOptions"), sel("alloc")), sel("init"))
	objc.Send(opts, sel("autorelease"))
	// Synchronous requests call their handler before returning, on this
	// thread, which is never the main one.
	pk.SendSetBool(opts, sel("setSynchronous:"), true)
	pk.SendSetInt(opts, sel("setDeliveryMode:"), phImageDeliveryHighQuality)
	// Photos kept only in iCloud ("Optimize Mac Storage") download.
	pk.SendSetBool(opts, sel("setNetworkAccessAllowed:"), true)
	return opts
}

// withLibraryImage renders the asset to fit in maxEdge px and passes the
// CGImage to use, during which it is valid.
func withLibraryImage(asset objcID, maxEdge int, use func(img cfRef) error) error {
	opts := newImageRequestOptions()
	pk.SendSetInt(opts, sel("setResizeMode:"), phImageResizeModeFast)
	var useErr error
	called := false
	block := pobjc.NewBlock(func(_ pobjc.Block, image, _ pobjc.ID) {
		called = true
		if image == 0 {
			useErr = errors.New(text().libraryNoImage)
			return
		}
		cg := pk.SendID3(objcID(image), sel("CGImageForProposedRect:context:hints:"), 0, 0, 0)
		if cg == 0 {
			useErr = errors.New(text().libraryNoImage)
			return
		}
		useErr = use(cg)
	})
	defer block.Release()
	manager := objc.Send(objc.GetClass("PHImageManager"), sel("defaultManager"))
	edge := float64(maxEdge)
	pk.RequestImage(manager, sel("requestImageForAsset:targetSize:contentMode:options:resultHandler:"), asset, edge, edge, phImageContentModeAspectFit, opts, objcID(block))
	if !called {
		return errors.New(text().libraryNoImage)
	}
	return useErr
}

// libraryThumbnailTarget is thumbnailTarget for a photo in the library.
func libraryThumbnailTarget(path string, maxEdge int) (thumbPath string, cached bool, err error) {
	maxEdge = min(max(maxEdge, thumbMinEdge), thumbMaxEdge)
	var stamp int64
	err = withPool(func() error {
		if err := requireLibraryAccess(); err != nil {
			return err
		}
		asset, err := fetchLibraryAsset(libraryAssetID(path))
		if err != nil {
			return err
		}
		stamp = assetStamp(asset)
		return nil
	})
	if err != nil {
		return "", false, err
	}
	return thumbSlot(libraryRoot, thumbKey(path, stamp, 0, false), maxEdge)
}

// writeLibraryThumbnail writes the photo at path, at most maxEdge px, to dst
// as a JPEG.
func writeLibraryThumbnail(path, dst string, maxEdge int, quality float64) error {
	return withPool(func() error {
		asset, err := fetchLibraryAsset(libraryAssetID(path))
		if err != nil {
			return err
		}
		return withLibraryImage(asset, maxEdge, func(img cfRef) error {
			return writeJPEG(img, dst, quality)
		})
	})
}

// webImageTypes maps the image types the web view shows to their MIME type.
var webImageTypes = map[string]string{
	"public.jpeg":          "image/jpeg",
	"public.heic":          "image/heic",
	"public.heif":          "image/heif",
	"public.png":           "image/png",
	"com.compuserve.gif":   "image/gif",
	"org.webmproject.webp": "image/webp",
	"public.tiff":          "image/tiff",
}

// serveLibraryPhoto serves a library photo at full size: its current
// version as stored, or, for a type the web view can't show (RAW), a JPEG
// rendered from it.
func serveLibraryPhoto(w http.ResponseWriter, r *http.Request, path string) {
	// The viewer drops photos it skipped past; reading those would hold up
	// the one now shown.
	if r.Context().Err() != nil {
		return
	}
	// The lightbox asks for the photo at the window's size, which Photos
	// renders in a fraction of a second; the original, often 24 megapixels or
	// more, took seconds to read and stalled the webview for seconds to decode.
	edge, _ := strconv.Atoi(r.URL.Query().Get("edge"))
	var (
		data     []byte
		mimeType string
		modified int64
	)
	err := withPool(func() error {
		if err := requireLibraryAccess(); err != nil {
			return err
		}
		asset, err := fetchLibraryAsset(libraryAssetID(path))
		if err != nil {
			return err
		}
		modified = assetStamp(asset)
		if edge <= 0 {
			data, mimeType = libraryImageData(asset)
			switch {
			case data == nil:
				edge = libraryPreviewEdge
			case mimeType == "image/heic" || mimeType == "image/heif":
				// WebKit takes seconds to decode a large HEIC photo, and
				// holds up the page decoding images after it meanwhile; the
				// same photo as a JPEG, at full size, takes a fraction of
				// a second.
				edge = max(pk.SendInt(asset, sel("pixelWidth")), pk.SendInt(asset, sel("pixelHeight")))
			default:
				return nil
			}
		}
		tmp, err := os.CreateTemp("", "picnest-library-*.jpg")
		if err != nil {
			return err
		}
		tmp.Close()
		defer os.Remove(tmp.Name())
		if err := withLibraryImage(asset, edge, func(img cfRef) error {
			return writeJPEG(img, tmp.Name(), previewJPEGQuality)
		}); err != nil {
			return err
		}
		data, err = os.ReadFile(tmp.Name())
		mimeType = "image/jpeg"
		return err
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", mimeType)
	http.ServeContent(w, r, "", time.Unix(modified, 0), bytes.NewReader(data))
}

// libraryImageData returns the photo's bytes if the web view can show them.
func libraryImageData(asset objcID) ([]byte, string) {
	var (
		data     []byte
		mimeType string
	)
	block := pobjc.NewBlock(func(_ pobjc.Block, imageData, uti pobjc.ID, _ uint32, _ pobjc.ID) {
		mimeType = webImageTypes[nsStringValue(objcID(uti))]
		if imageData == 0 || mimeType == "" {
			return
		}
		n := int(objc.SendCount(objcID(imageData), sel("length")))
		ptr := objc.Send(objcID(imageData), sel("bytes"))
		if n == 0 || ptr == 0 {
			return
		}
		data = make([]byte, n)
		copy(data, unsafe.Slice((*byte)(*(*unsafe.Pointer)(unsafe.Pointer(&ptr))), n))
	})
	defer block.Release()
	manager := objc.Send(objc.GetClass("PHImageManager"), sel("defaultManager"))
	pk.SendID3(manager, sel("requestImageDataAndOrientationForAsset:options:resultHandler:"), asset, newImageRequestOptions(), objcID(block))
	return data, mimeType
}

func libraryPhotoDetails(path string) (PhotoDetails, error) {
	var details PhotoDetails
	err := withPool(func() error {
		if err := requireLibraryAccess(); err != nil {
			return err
		}
		asset, err := fetchLibraryAsset(libraryAssetID(path))
		if err != nil {
			return err
		}
		if created := unixSeconds(objc.Send(asset, sel("creationDate"))); created != 0 {
			details.Created = &created
		}
		return nil
	})
	return details, err
}
