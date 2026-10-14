package main

import (
	"bytes"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/egoist/mygo"
)

// localFileScheme serves files from disk to the webview (thumbnails and
// full-size previews): localfile://localhost/?path=<absolute path>.
const localFileScheme = "localfile"

func serveLocalFile(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if !strings.HasPrefix(path, "/") {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	if isProcreateFile(path) {
		serveProcreatePreview(w, r, path)
		return
	}
	http.ServeFile(w, r, path)
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
