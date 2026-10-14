package main

import (
	"log"
	"net/http"
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
	http.ServeFile(w, r, path)
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
			// Centers the traffic lights on the toolbar row (40px tall, so
			// its midline is y=20) instead of hugging the window corner.
			TrafficLightPosition: &mygo.Point{X: 16, Y: 13},
			URL:                  "/",
		})
		unlockFrameRate(w.NativeHandle())
	})

	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
