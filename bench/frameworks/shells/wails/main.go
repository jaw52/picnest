// A bare Wails v3 window on the bench page: the page runs itself (?auto=1).
package main

import (
	"log"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func main() {
	app := application.New(application.Options{Name: "bench"})
	app.Window.NewWithOptions(application.WebviewWindowOptions{Title: "bench", URL: os.Args[1], Width: 1200, Height: 800})
	if err := app.Run(); err != nil {
		log.Fatal(err)
	}
}
