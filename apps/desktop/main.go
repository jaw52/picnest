package main

import (
	"bytes"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/egoist/mygo"
)

// localFileScheme serves files from disk to the webview (thumbnails and
// full-size previews): localfile://localhost/?path=<absolute path>, with
// &edge=<px> for a photo scaled down to fit that many pixels (see
// servePreview).
const localFileScheme = "localfile"

// previewJPEGQuality is higher than the thumbnails', as a preview is seen
// pixel for pixel.
const previewJPEGQuality = 0.9

func serveLocalFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if isLibraryPath(path) {
		serveLibraryPhoto(w, r, path)
		return
	}
	if !strings.HasPrefix(path, "/") {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	if isProcreateFile(path) {
		serveProcreatePreview(w, r, path)
		return
	}
	if edge, err := strconv.Atoi(r.URL.Query().Get("edge")); err == nil && edge > 0 {
		servePreview(w, r, path, edge)
		return
	}
	http.ServeFile(w, r, path)
}

// servePreview serves a JPEG photo scaled down to fit maxEdge px, for the
// lightbox to show at fit: painting a photo of 12 megapixels or more stalls
// the webview for a frame of 100ms or longer, even decoded beforehand.
// Other files (which may be transparent or animated), and photos no larger
// than maxEdge, are served as they are.
func servePreview(w http.ResponseWriter, r *http.Request, path string, maxEdge int) {
	// The viewer drops photos it skipped past; scaling those would hold up
	// the one now shown.
	if r.Context().Err() != nil {
		return
	}
	ext := strings.ToLower(filepath.Ext(path))
	width, height, err := imageDimensions(path)
	if (ext != ".jpg" && ext != ".jpeg") || err != nil || max(width, height) <= maxEdge {
		http.ServeFile(w, r, path)
		return
	}
	info, err := os.Stat(path)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	tmp, err := os.CreateTemp("", "picnest-preview-*.jpg")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tmp.Close()
	defer os.Remove(tmp.Name())
	if err := writePreview(path, tmp.Name(), maxEdge, previewJPEGQuality); err != nil {
		http.ServeFile(w, r, path)
		return
	}
	data, err := os.ReadFile(tmp.Name())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "image/jpeg")
	http.ServeContent(w, r, "", info.ModTime(), bytes.NewReader(data))
}

// serveProcreatePreview serves the preview PNG inside a .procreate file,
// since the webview can't display the archive itself.
func serveProcreatePreview(w http.ResponseWriter, r *http.Request, path string) {
	info, err := os.Stat(path)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	png, err := readProcreatePreview(path)
	if err != nil {
		http.Error(w, "no preview", http.StatusUnsupportedMediaType)
		return
	}
	w.Header().Set("Content-Type", "image/png")
	http.ServeContent(w, r, "", info.ModTime(), bytes.NewReader(png))
}

func main() {
	mygo.Bind(NewApp())
	mygo.Bind(Native{})
	if err := mygo.Protocol.HandleFunc(localFileScheme, serveLocalFile); err != nil {
		log.Fatal(err)
	}

	loadLanguage()
	mygo.App.SetMenu(appMenu())

	mygo.App.WhenReady(func() {
		w := mygo.NewWindow(mygo.WindowOptions{
			Title:         "Picnest",
			Width:         1280,
			Height:        840,
			MinWidth:      900,
			MinHeight:     600,
			TitleBarStyle: mygo.TitleBarHidden,
			// Centers the traffic lights (14px tall) on the tabs' midline,
			// y=24 (see the toolbar in Toolbar.tsx), instead of hugging the
			// window corner.
			TrafficLightPosition: &mygo.Point{X: 16, Y: 17},
			URL:                  "/",
		})
		unlockFrameRate(w.NativeHandle())
	})

	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
