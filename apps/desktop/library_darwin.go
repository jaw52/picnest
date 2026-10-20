package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
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
// asset's local identifier. The one write is deleteLibraryPhotos, which
// macOS has the user confirm.

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
	phAssetResourceTypeVideo      = 9  // PHAssetResourceTypePairedVideo
	phAssetResourceTypeFullVideo  = 10 // PHAssetResourceTypeFullSizePairedVideo
	phAssetPlaybackStyleLive      = 3
	phAssetPlaybackStyleLoop      = 5
	phAuthorizationNotDetermined  = 0
	phAuthorizationRestricted     = 1
	phAuthorizationDenied         = 2
	phAuthorizationAuthorized     = 3
	phAuthorizationLimited        = 4
	phPhotosErrorUserCancelled    = 3072
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
		SendID4      func(obj, sel, a, b, c, d objcID)
		RequestImage func(obj, sel, asset objcID, width, height float64, mode int, opts, handler objcID) int32
		SendChanges  func(obj, sel, changes objcID, nserr *objcID) bool
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
		purego.RegisterLibFunc(&pk.SendID4, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.RequestImage, lib, "objc_msgSend")
		purego.RegisterLibFunc(&pk.SendChanges, lib, "objc_msgSend")
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
				Taken:    unixSeconds(objc.Send(asset, sel("creationDate"))),
				Live:     assetLive(asset),
			})
			objc.PoolPop(pool)
		}
		return nil
	})
	return page, err
}

// assetLive is how the photo moves: as a Live Photo, as a loop or bounce
// made of one, or not at all, including a Live Photo with Live turned off.
func assetLive(asset objcID) LiveKind {
	switch pk.SendInt(asset, sel("playbackStyle")) {
	case phAssetPlaybackStyleLive:
		return LiveKindLive
	case phAssetPlaybackStyleLoop:
		return LiveKindLoop
	default:
		return ""
	}
}

// fetchLibraryAssets fetches the assets of the photos at paths that are
// still in the library.
func fetchLibraryAssets(paths []string) objcID {
	ids := objc.Send(objc.GetClass("NSMutableArray"), sel("array"))
	for _, path := range paths {
		objc.SendID(ids, sel("addObject:"), nsString(libraryAssetID(path)))
	}
	return pk.SendID2(objc.GetClass("PHAsset"), sel("fetchAssetsWithLocalIdentifiers:options:"), ids, 0)
}

// libraryFileNames returns the names the photos at paths had when imported,
// by path, leaving out photos no longer in the library.
func libraryFileNames(paths []string) (map[string]string, error) {
	names := make(map[string]string, len(paths))
	err := withPool(func() error {
		if err := requireLibraryAccess(); err != nil {
			return err
		}
		result := fetchLibraryAssets(paths)
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

// deleteLibraryPhotos deletes the photos at paths from the Photos library,
// once macOS has asked the user to allow it, into its Recently Deleted
// album. It returns the paths deleted: all of those still in the library,
// or none if the user said no. Photos already gone are left out.
func deleteLibraryPhotos(paths []string) ([]string, error) {
	deleted := []string{}
	err := withPool(func() error {
		if err := requireLibraryAccess(); err != nil {
			return err
		}
		assets := fetchLibraryAssets(paths)
		count := int(objc.SendCount(assets, sel("count")))
		if count == 0 {
			return nil
		}
		found := make([]string, 0, count)
		for i := range count {
			asset := objc.SendIndex(assets, sel("objectAtIndex:"), uint(i))
			found = append(found, libraryRoot+nsStringValue(objc.Send(asset, sel("localIdentifier"))))
		}
		changes := pobjc.NewBlock(func(_ pobjc.Block) {
			objc.SendID(objc.GetClass("PHAssetChangeRequest"), sel("deleteAssets:"), assets)
		})
		// PhotoKit copies the block; this reference is ours alone.
		defer changes.Release()
		library := objc.Send(objc.GetClass("PHPhotoLibrary"), sel("sharedPhotoLibrary"))
		var nserr objcID
		if !pk.SendChanges(library, sel("performChangesAndWait:error:"), objcID(changes), &nserr) {
			if nserr == 0 {
				return errors.New(text().libraryNotDeleted)
			}
			if pk.SendInt(nserr, sel("code")) == phPhotosErrorUserCancelled {
				return nil
			}
			return errors.New(nsStringValue(objc.Send(nserr, sel("localizedDescription"))))
		}
		deleted = found
		return nil
	})
	return deleted, err
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

// liveVideoDir holds the Live Photos' videos played so far, which Photos
// hands over only as a file written out.
func liveVideoDir() string {
	return filepath.Join(libraryDataDir(), "live")
}

// serveLibraryLiveVideo serves the video of a Live Photo in the library: its
// edited version if it has one. The first time, it is written out of Photos
// (downloaded from iCloud if need be) into liveVideoDir. The request names
// the photo's assetStamp (v), so the video, once written, is found without
// asking Photos: the web view reads a video in many range requests, and a
// fetch from Photos for each kept photolibraryd and the app busy.
func serveLibraryLiveVideo(w http.ResponseWriter, r *http.Request, path string) {
	stamp, _ := strconv.ParseInt(r.URL.Query().Get("v"), 10, 64)
	h := sha256.New()
	h.Write([]byte(path))
	h.Write(binary.LittleEndian.AppendUint64(nil, uint64(stamp)))
	video := filepath.Join(liveVideoDir(), hex.EncodeToString(h.Sum(nil))+".mov")
	if err := writeLibraryLiveVideo(path, video); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	http.ServeFile(w, r, video)
}

// liveVideoWrites lets one request write a video out of Photos while those
// for the same video, arriving together, wait for it.
var liveVideoWrites sync.Mutex

// writeLibraryLiveVideo writes the video of the Live Photo at path to video,
// unless it is there already.
func writeLibraryLiveVideo(path, video string) error {
	if _, err := os.Stat(video); err == nil {
		return nil
	}
	liveVideoWrites.Lock()
	defer liveVideoWrites.Unlock()
	if _, err := os.Stat(video); err == nil {
		return nil
	}
	return withPool(func() error {
		if err := requireLibraryAccess(); err != nil {
			return err
		}
		asset, err := fetchLibraryAsset(libraryAssetID(path))
		if err != nil {
			return err
		}
		res := liveVideoResource(asset)
		if res == 0 {
			return errors.New(text().libraryNoLiveVideo)
		}
		if err := os.MkdirAll(liveVideoDir(), 0o755); err != nil {
			return err
		}
		// Written beside the video and moved into place once whole, so a
		// request meanwhile never serves half of it.
		tmp, err := os.CreateTemp(liveVideoDir(), "*.mov.part")
		if err != nil {
			return err
		}
		tmp.Close()
		// Photos won't write over a file.
		os.Remove(tmp.Name())
		defer os.Remove(tmp.Name())
		if err := writeAssetResource(res, tmp.Name()); err != nil {
			return err
		}
		return os.Rename(tmp.Name(), video)
	})
}

// liveVideoResource returns the asset's edited video if it has one, else
// its original video, or 0 for a photo without one.
func liveVideoResource(asset objcID) objcID {
	resources := objc.SendID(objc.GetClass("PHAssetResource"), sel("assetResourcesForAsset:"), asset)
	var found objcID
	for i := range int(objc.SendCount(resources, sel("count"))) {
		res := objc.SendIndex(resources, sel("objectAtIndex:"), uint(i))
		switch pk.SendInt(res, sel("type")) {
		case phAssetResourceTypeFullVideo:
			return res
		case phAssetResourceTypeVideo:
			found = res
		}
	}
	return found
}

// writeAssetResource writes the resource to the file at dst, which must not
// exist, waiting for it to be written.
func writeAssetResource(res objcID, dst string) error {
	opts := objc.Send(objc.Send(objc.GetClass("PHAssetResourceRequestOptions"), sel("alloc")), sel("init"))
	objc.Send(opts, sel("autorelease"))
	// Photos kept only in iCloud ("Optimize Mac Storage") download.
	pk.SendSetBool(opts, sel("setNetworkAccessAllowed:"), true)
	done := make(chan string, 1)
	// Called once, on a queue of Photos' own.
	block := pobjc.NewBlock(func(_ pobjc.Block, nserr pobjc.ID) {
		if nserr == 0 {
			done <- ""
			return
		}
		done <- nsStringValue(objc.Send(objcID(nserr), sel("localizedDescription")))
	})
	defer block.Release()
	manager := objc.Send(objc.GetClass("PHAssetResourceManager"), sel("defaultManager"))
	pk.SendID4(manager, sel("writeDataForAssetResource:toFile:options:completionHandler:"), res, fileURL(dst), opts, objcID(block))
	if msg := <-done; msg != "" {
		return errors.New(msg)
	}
	return nil
}
