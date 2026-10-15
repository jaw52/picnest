package main

import (
	"encoding/json"
	"errors"
	"sync"
	"unsafe"

	"github.com/ebitengine/purego"
)

// ImageIO / CoreFoundation bindings loaded through purego, so the app builds
// with CGO_ENABLED=0.

type cfRef = uintptr

const (
	kCFStringEncodingUTF8 = 0x08000100
	kCFNumberSInt32Type   = 3
	kCFNumberSInt64Type   = 4
	kCFNumberFloat64Type  = 6
)

var (
	cf struct {
		Release                    func(cfRef)
		GetTypeID                  func(cfRef) uint
		StringGetTypeID            func() uint
		NumberGetTypeID            func() uint
		ArrayGetTypeID             func() uint
		StringCreateWithCString    func(alloc cfRef, s *byte, enc uint32) cfRef
		StringGetLength            func(cfRef) int
		StringGetMaxSize           func(length int, enc uint32) int
		StringGetCString           func(s cfRef, buf *byte, size int, enc uint32) bool
		NumberCreate               func(alloc cfRef, typ int, v unsafe.Pointer) cfRef
		NumberGetValue             func(n cfRef, typ int, v unsafe.Pointer) bool
		NumberIsFloatType          func(cfRef) bool
		ArrayGetCount              func(cfRef) int
		ArrayGetValueAtIndex       func(cfRef, int) cfRef
		DictionaryCreate           func(alloc cfRef, keys, values *cfRef, n int, kcb, vcb cfRef) cfRef
		DictionaryGetValue         func(dict, key cfRef) cfRef
		URLCreateFromFSRepresenter func(alloc cfRef, path *byte, n int, isDir bool) cfRef
		DataCreate                 func(alloc cfRef, bytes *byte, n int) cfRef
	}
	imgio struct {
		SourceCreateWithURL      func(url, opts cfRef) cfRef
		SourceCreateWithData     func(data, opts cfRef) cfRef
		SourceCopyProperties     func(src cfRef, idx int, opts cfRef) cfRef
		SourceGetCount           func(src cfRef) int
		SourceCreateThumbnail    func(src cfRef, idx int, opts cfRef) cfRef
		DestinationCreateWithURL func(url, typ cfRef, count int, opts cfRef) cfRef
		DestinationAddImage      func(dest, img, props cfRef)
		DestinationFinalize      func(dest cfRef) bool
		ImageRelease             func(cfRef)
		ImageGetWidth            func(cfRef) int
		ImageGetHeight           func(cfRef) int
	}

	kCFAllocatorDefault cfRef
	kCFBooleanTrue      cfRef
	kTypeKeyCallbacks   cfRef
	kTypeValueCallbacks cfRef

	kPixelWidth, kPixelHeight, kOrientation       cfRef
	kHasAlpha                                     cfRef
	kThumbFromImageAlways, kThumbMaxPixelSize     cfRef
	kThumbWithTransform                           cfRef
	kShouldCache, kShouldCacheImmediately         cfRef
	kLossyQuality                                 cfRef
	kTIFFDict, kExifDict                          cfRef
	kTIFFMake, kTIFFModel                         cfRef
	kExifLens, kExifFocal, kExifFNumber           cfRef
	kExifExposure, kExifISO, kExifBias, kExifDate cfRef
	kBooleanFalse                                 cfRef
	loadOnce                                      sync.Once
	loadErr                                       error
)

func loadFrameworks() error {
	loadOnce.Do(func() {
		const fw = "/System/Library/Frameworks/"
		coreFoundation, err := purego.Dlopen(fw+"CoreFoundation.framework/CoreFoundation", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			loadErr = err
			return
		}
		imageIO, err := purego.Dlopen(fw+"ImageIO.framework/ImageIO", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			loadErr = err
			return
		}
		coreGraphics, err := purego.Dlopen(fw+"CoreGraphics.framework/CoreGraphics", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			loadErr = err
			return
		}

		purego.RegisterLibFunc(&cf.Release, coreFoundation, "CFRelease")
		purego.RegisterLibFunc(&cf.GetTypeID, coreFoundation, "CFGetTypeID")
		purego.RegisterLibFunc(&cf.StringGetTypeID, coreFoundation, "CFStringGetTypeID")
		purego.RegisterLibFunc(&cf.NumberGetTypeID, coreFoundation, "CFNumberGetTypeID")
		purego.RegisterLibFunc(&cf.ArrayGetTypeID, coreFoundation, "CFArrayGetTypeID")
		purego.RegisterLibFunc(&cf.StringCreateWithCString, coreFoundation, "CFStringCreateWithCString")
		purego.RegisterLibFunc(&cf.StringGetLength, coreFoundation, "CFStringGetLength")
		purego.RegisterLibFunc(&cf.StringGetMaxSize, coreFoundation, "CFStringGetMaximumSizeForEncoding")
		purego.RegisterLibFunc(&cf.StringGetCString, coreFoundation, "CFStringGetCString")
		purego.RegisterLibFunc(&cf.NumberCreate, coreFoundation, "CFNumberCreate")
		purego.RegisterLibFunc(&cf.NumberGetValue, coreFoundation, "CFNumberGetValue")
		purego.RegisterLibFunc(&cf.NumberIsFloatType, coreFoundation, "CFNumberIsFloatType")
		purego.RegisterLibFunc(&cf.ArrayGetCount, coreFoundation, "CFArrayGetCount")
		purego.RegisterLibFunc(&cf.ArrayGetValueAtIndex, coreFoundation, "CFArrayGetValueAtIndex")
		purego.RegisterLibFunc(&cf.DictionaryCreate, coreFoundation, "CFDictionaryCreate")
		purego.RegisterLibFunc(&cf.DictionaryGetValue, coreFoundation, "CFDictionaryGetValue")
		purego.RegisterLibFunc(&cf.URLCreateFromFSRepresenter, coreFoundation, "CFURLCreateFromFileSystemRepresentation")
		purego.RegisterLibFunc(&cf.DataCreate, coreFoundation, "CFDataCreate")

		purego.RegisterLibFunc(&imgio.SourceCreateWithURL, imageIO, "CGImageSourceCreateWithURL")
		purego.RegisterLibFunc(&imgio.SourceCreateWithData, imageIO, "CGImageSourceCreateWithData")
		purego.RegisterLibFunc(&imgio.SourceCopyProperties, imageIO, "CGImageSourceCopyPropertiesAtIndex")
		purego.RegisterLibFunc(&imgio.SourceGetCount, imageIO, "CGImageSourceGetCount")
		purego.RegisterLibFunc(&imgio.SourceCreateThumbnail, imageIO, "CGImageSourceCreateThumbnailAtIndex")
		purego.RegisterLibFunc(&imgio.DestinationCreateWithURL, imageIO, "CGImageDestinationCreateWithURL")
		purego.RegisterLibFunc(&imgio.DestinationAddImage, imageIO, "CGImageDestinationAddImage")
		purego.RegisterLibFunc(&imgio.DestinationFinalize, imageIO, "CGImageDestinationFinalize")
		purego.RegisterLibFunc(&imgio.ImageRelease, coreGraphics, "CGImageRelease")
		purego.RegisterLibFunc(&imgio.ImageGetWidth, coreGraphics, "CGImageGetWidth")
		purego.RegisterLibFunc(&imgio.ImageGetHeight, coreGraphics, "CGImageGetHeight")

		// Exported constants are variables holding a CFTypeRef: read through the symbol address.
		sym := func(lib uintptr, name string) cfRef {
			addr, err := purego.Dlsym(lib, name)
			if err != nil {
				if loadErr == nil {
					loadErr = err
				}
				return 0
			}
			return **(**cfRef)(unsafe.Pointer(&addr)) // addr points at a C global
		}
		symAddr := func(lib uintptr, name string) cfRef {
			addr, err := purego.Dlsym(lib, name)
			if err != nil && loadErr == nil {
				loadErr = err
			}
			return addr
		}

		kCFAllocatorDefault = 0
		kCFBooleanTrue = sym(coreFoundation, "kCFBooleanTrue")
		kBooleanFalse = sym(coreFoundation, "kCFBooleanFalse")
		kTypeKeyCallbacks = symAddr(coreFoundation, "kCFTypeDictionaryKeyCallBacks")
		kTypeValueCallbacks = symAddr(coreFoundation, "kCFTypeDictionaryValueCallBacks")

		kPixelWidth = sym(imageIO, "kCGImagePropertyPixelWidth")
		kPixelHeight = sym(imageIO, "kCGImagePropertyPixelHeight")
		kOrientation = sym(imageIO, "kCGImagePropertyOrientation")
		kHasAlpha = sym(imageIO, "kCGImagePropertyHasAlpha")
		kThumbFromImageAlways = sym(imageIO, "kCGImageSourceCreateThumbnailFromImageAlways")
		kThumbMaxPixelSize = sym(imageIO, "kCGImageSourceThumbnailMaxPixelSize")
		kThumbWithTransform = sym(imageIO, "kCGImageSourceCreateThumbnailWithTransform")
		kShouldCache = sym(imageIO, "kCGImageSourceShouldCache")
		kShouldCacheImmediately = sym(imageIO, "kCGImageSourceShouldCacheImmediately")
		kLossyQuality = sym(imageIO, "kCGImageDestinationLossyCompressionQuality")
		kTIFFDict = sym(imageIO, "kCGImagePropertyTIFFDictionary")
		kExifDict = sym(imageIO, "kCGImagePropertyExifDictionary")
		kTIFFMake = sym(imageIO, "kCGImagePropertyTIFFMake")
		kTIFFModel = sym(imageIO, "kCGImagePropertyTIFFModel")
		kExifLens = sym(imageIO, "kCGImagePropertyExifLensModel")
		kExifFocal = sym(imageIO, "kCGImagePropertyExifFocalLength")
		kExifFNumber = sym(imageIO, "kCGImagePropertyExifFNumber")
		kExifExposure = sym(imageIO, "kCGImagePropertyExifExposureTime")
		kExifISO = sym(imageIO, "kCGImagePropertyExifISOSpeedRatings")
		kExifBias = sym(imageIO, "kCGImagePropertyExifExposureBiasValue")
		kExifDate = sym(imageIO, "kCGImagePropertyExifDateTimeOriginal")
	})
	return loadErr
}

func cstr(s string) *byte {
	b := append([]byte(s), 0)
	return &b[0]
}

func newURL(path string) cfRef {
	return cf.URLCreateFromFSRepresenter(kCFAllocatorDefault, cstr(path), len(path), false)
}

func newCFString(s string) cfRef {
	return cf.StringCreateWithCString(kCFAllocatorDefault, cstr(s), kCFStringEncodingUTF8)
}

func newCFInt(v int32) cfRef {
	return cf.NumberCreate(kCFAllocatorDefault, kCFNumberSInt32Type, unsafe.Pointer(&v))
}

func newCFFloat(v float64) cfRef {
	return cf.NumberCreate(kCFAllocatorDefault, kCFNumberFloat64Type, unsafe.Pointer(&v))
}

func newCFDict(keys, values []cfRef) cfRef {
	return cf.DictionaryCreate(kCFAllocatorDefault, &keys[0], &values[0], len(keys), kTypeKeyCallbacks, kTypeValueCallbacks)
}

// openSource opens an image for ImageIO. A .procreate file opens as the
// preview PNG stored inside it.
func openSource(path string) cfRef {
	opts := newCFDict([]cfRef{kShouldCache}, []cfRef{kBooleanFalse})
	defer cf.Release(opts)
	if isProcreateFile(path) {
		png, err := readProcreatePreview(path)
		if err != nil || len(png) == 0 {
			return 0
		}
		data := cf.DataCreate(kCFAllocatorDefault, &png[0], len(png))
		if data == 0 {
			return 0
		}
		defer cf.Release(data)
		return imgio.SourceCreateWithData(data, opts)
	}
	url := newURL(path)
	if url == 0 {
		return 0
	}
	defer cf.Release(url)
	return imgio.SourceCreateWithURL(url, opts)
}

func cfNumberToInt(n cfRef) (int, bool) {
	var v int64
	if !cf.NumberGetValue(n, kCFNumberSInt64Type, unsafe.Pointer(&v)) {
		return 0, false
	}
	return int(v), true
}

// cfToGo converts strings, numbers and arrays of them; other types yield ok=false.
func cfToGo(v cfRef) (any, bool) {
	if v == 0 {
		return nil, false
	}
	switch cf.GetTypeID(v) {
	case cf.StringGetTypeID():
		size := cf.StringGetMaxSize(cf.StringGetLength(v), kCFStringEncodingUTF8) + 1
		buf := make([]byte, size)
		if !cf.StringGetCString(v, &buf[0], size, kCFStringEncodingUTF8) {
			return nil, false
		}
		n := 0
		for n < len(buf) && buf[n] != 0 {
			n++
		}
		return string(buf[:n]), true
	case cf.NumberGetTypeID():
		if cf.NumberIsFloatType(v) {
			var f float64
			if !cf.NumberGetValue(v, kCFNumberFloat64Type, unsafe.Pointer(&f)) {
				return nil, false
			}
			return f, true
		}
		i, ok := cfNumberToInt(v)
		return i, ok
	case cf.ArrayGetTypeID():
		count := cf.ArrayGetCount(v)
		out := make([]any, 0, count)
		for i := range count {
			if item, ok := cfToGo(cf.ArrayGetValueAtIndex(v, i)); ok {
				out = append(out, item)
			}
		}
		return out, true
	}
	return nil, false
}

// imageDimensions reads the photo's dimensions as shown, turned upright by its
// EXIF orientation, from the file header without decoding pixels.
func imageDimensions(path string) (int, int, error) {
	if err := loadFrameworks(); err != nil {
		return 0, 0, err
	}
	src := openSource(path)
	if src == 0 {
		return 0, 0, errors.New("unsupported image")
	}
	defer cf.Release(src)
	props := imgio.SourceCopyProperties(src, 0, 0)
	if props == 0 {
		return 0, 0, errors.New("failed to read image dimensions")
	}
	defer cf.Release(props)
	w, okW := cfNumberToInt(cf.DictionaryGetValue(props, kPixelWidth))
	h, okH := cfNumberToInt(cf.DictionaryGetValue(props, kPixelHeight))
	if !okW || !okH {
		return 0, 0, errors.New("failed to read image dimensions")
	}
	// Orientations 5–8 are stored turned a quarter.
	if o := cf.DictionaryGetValue(props, kOrientation); o != 0 {
		if n, ok := cfNumberToInt(o); ok && n >= 5 && n <= 8 {
			w, h = h, w
		}
	}
	return w, h, nil
}

// imageKind reports whether an image has an alpha channel, and whether it
// has more than one frame (an animated PNG or GIF).
func imageKind(path string) (alpha, animated bool, err error) {
	if err := loadFrameworks(); err != nil {
		return false, false, err
	}
	src := openSource(path)
	if src == 0 {
		return false, false, errors.New("unsupported image")
	}
	defer cf.Release(src)
	props := imgio.SourceCopyProperties(src, 0, 0)
	if props == 0 {
		return false, false, errors.New("failed to read image properties")
	}
	defer cf.Release(props)
	return cf.DictionaryGetValue(props, kHasAlpha) == kCFBooleanTrue, imgio.SourceGetCount(src) > 1, nil
}

// writeThumbnail decodes straight to a reduced size (ImageIO uses subsampled
// JPEG decoding), turns it upright by the photo's EXIF orientation, and
// writes it out as a JPEG.
func writeThumbnail(src, dst string, maxEdge int, quality float64) error {
	return withScaledImage(src, maxEdge, func(img cfRef) error {
		return writeJPEG(img, dst, quality)
	})
}

// writePNGThumbnail is writeThumbnail written out as a PNG, which keeps
// transparency.
func writePNGThumbnail(src, dst string, maxEdge int) error {
	return withScaledImage(src, maxEdge, func(img cfRef) error {
		return writeImage(img, dst, "public.png", 0)
	})
}

// withScaledImage decodes src at most maxEdge px on its longest side,
// turned upright, and passes the CGImage to use, during which it is valid.
func withScaledImage(src string, maxEdge int, use func(img cfRef) error) error {
	if err := loadFrameworks(); err != nil {
		return err
	}
	source := openSource(src)
	if source == 0 {
		return errors.New("failed to decode image")
	}
	defer cf.Release(source)

	edge := newCFInt(int32(maxEdge))
	defer cf.Release(edge)
	opts := newCFDict(
		[]cfRef{kThumbFromImageAlways, kThumbMaxPixelSize, kShouldCacheImmediately, kThumbWithTransform},
		[]cfRef{kCFBooleanTrue, edge, kCFBooleanTrue, kCFBooleanTrue},
	)
	defer cf.Release(opts)
	thumb := imgio.SourceCreateThumbnail(source, 0, opts)
	if thumb == 0 {
		return errors.New("failed to decode image")
	}
	defer imgio.ImageRelease(thumb)
	return use(thumb)
}

// writeJPEG encodes a CGImage to dst.
func writeJPEG(img cfRef, dst string, quality float64) error {
	return writeImage(img, dst, "public.jpeg", quality)
}

// writeImage encodes a CGImage to dst as the type uti, at quality if it is
// lossy (quality > 0).
func writeImage(img cfRef, dst, uti string, quality float64) error {
	url := newURL(dst)
	if url == 0 {
		return errors.New("failed to create thumbnail file")
	}
	defer cf.Release(url)
	typ := newCFString(uti)
	defer cf.Release(typ)
	dest := imgio.DestinationCreateWithURL(url, typ, 1, 0)
	if dest == 0 {
		return errors.New("failed to create thumbnail file")
	}
	defer cf.Release(dest)

	var props cfRef
	if quality > 0 {
		q := newCFFloat(quality)
		defer cf.Release(q)
		props = newCFDict([]cfRef{kLossyQuality}, []cfRef{q})
		defer cf.Release(props)
	}
	imgio.DestinationAddImage(dest, img, props)
	if !imgio.DestinationFinalize(dest) {
		return errors.New("failed to encode thumbnail")
	}
	return nil
}

// readExifJSON returns the EXIF fields the UI shows as a JSON object, or nil if none.
func readExifJSON(path string) []byte {
	if err := loadFrameworks(); err != nil {
		return nil
	}
	src := openSource(path)
	if src == 0 {
		return nil
	}
	defer cf.Release(src)
	props := imgio.SourceCopyProperties(src, 0, 0)
	if props == 0 {
		return nil
	}
	defer cf.Release(props)

	out := map[string]any{}
	pick := func(dict, key cfRef, name string) {
		if v, ok := cfToGo(cf.DictionaryGetValue(dict, key)); ok {
			out[name] = v
		}
	}
	if tiff := cf.DictionaryGetValue(props, kTIFFDict); tiff != 0 {
		pick(tiff, kTIFFMake, "make")
		pick(tiff, kTIFFModel, "model")
	}
	if exif := cf.DictionaryGetValue(props, kExifDict); exif != 0 {
		pick(exif, kExifLens, "lensModel")
		pick(exif, kExifFocal, "focalLength")
		pick(exif, kExifFNumber, "fNumber")
		pick(exif, kExifExposure, "exposureTime")
		pick(exif, kExifISO, "iso")
		pick(exif, kExifBias, "exposureBias")
		pick(exif, kExifDate, "dateTimeOriginal")
	}
	if len(out) == 0 {
		return nil
	}
	data, err := json.Marshal(out)
	if err != nil {
		return nil
	}
	return data
}
