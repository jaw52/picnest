// A bare mygo window on the bench page: the page runs itself (?auto=1).
package main

import (
	"log"
	"os"

	"github.com/egoist/mygo"
)

func main() {
	url := os.Args[1]
	mygo.App.WhenReady(func() {
		mygo.NewWindow(mygo.WindowOptions{Title: "bench", URL: url, Width: 1200, Height: 800})
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}
