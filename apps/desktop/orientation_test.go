package main

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

// writeRotatedJPEG writes a 40x30 JPEG, red on its left half and blue on its
// right, tagged with EXIF orientation 6 (shown turned 90° clockwise), as a
// phone stores a portrait photo. Upright it is 30x40, red on top.
func writeRotatedJPEG(t *testing.T, path string) {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 40, 30))
	for y := range 30 {
		for x := range 40 {
			c := color.RGBA{255, 0, 0, 255}
			if x >= 20 {
				c = color.RGBA{0, 0, 255, 255}
			}
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 95}); err != nil {
		t.Fatal(err)
	}

	// An APP1 segment holding a big-endian TIFF whose one IFD entry is
	// Orientation (0x0112), SHORT, count 1, value 6.
	tiff := []byte("MM\x00\x2a")
	tiff = binary.BigEndian.AppendUint32(tiff, 8) // first IFD offset
	tiff = binary.BigEndian.AppendUint16(tiff, 1) // entry count
	tiff = binary.BigEndian.AppendUint16(tiff, 0x0112)
	tiff = binary.BigEndian.AppendUint16(tiff, 3)
	tiff = binary.BigEndian.AppendUint32(tiff, 1)
	tiff = binary.BigEndian.AppendUint32(tiff, 6<<16) // value, left-justified
	tiff = binary.BigEndian.AppendUint32(tiff, 0)     // no next IFD
	payload := append([]byte("Exif\x00\x00"), tiff...)
	app1 := binary.BigEndian.AppendUint16([]byte{0xFF, 0xE1}, uint16(len(payload)+2))
	app1 = append(app1, payload...)

	data := buf.Bytes()
	out := append(append(append([]byte{}, data[:2]...), app1...), data[2:]...) // right after SOI
	if err := os.WriteFile(path, out, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestDimensionsFollowOrientation(t *testing.T) {
	dir := t.TempDir()
	writeRotatedJPEG(t, filepath.Join(dir, "portrait.jpg"))

	page, err := scanFolderPage(dir, 0, 100)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Photos) != 1 || page.Photos[0].Width != 30 || page.Photos[0].Height != 40 {
		t.Fatalf("want upright 30x40, got %+v", page.Photos)
	}
}

func TestThumbnailIsUpright(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "portrait.jpg")
	writeRotatedJPEG(t, src)

	thumb, err := ensureThumbnail(dir, src, 480)
	if err != nil {
		t.Fatal(err)
	}
	f, err := os.Open(thumb)
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	img, err := jpeg.Decode(f)
	if err != nil {
		t.Fatal(err)
	}
	if b := img.Bounds(); b.Dx() != 30 || b.Dy() != 40 {
		t.Fatalf("want upright 30x40 thumbnail, got %dx%d", b.Dx(), b.Dy())
	}
	isRed := func(x, y int) bool {
		r, _, b, _ := img.At(x, y).RGBA()
		return r > b
	}
	if !isRed(15, 5) || isRed(15, 35) {
		t.Fatal("thumbnail is not upright: want red on top, blue below")
	}
}
