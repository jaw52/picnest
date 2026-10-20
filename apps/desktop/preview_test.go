package main

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
)

// writeFilledPNG writes a w×h PNG of one color; Go writes it without an
// alpha channel when the color is opaque.
func writeFilledPNG(t *testing.T, path string, w, h int, c color.NRGBA) {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for i := 0; i < len(img.Pix); i += 4 {
		img.Pix[i], img.Pix[i+1], img.Pix[i+2], img.Pix[i+3] = c.R, c.G, c.B, c.A
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
}

func previewOf(t *testing.T, path, edge string) (contentType string, body []byte) {
	t.Helper()
	rec := httptest.NewRecorder()
	serveLocalFile(rec, httptest.NewRequest(http.MethodGet, "/?path="+url.QueryEscape(path)+"&edge="+edge, http.NoBody))
	if rec.Code != 200 {
		t.Fatalf("status %d", rec.Code)
	}
	return rec.Header().Get("Content-Type"), rec.Body.Bytes()
}

func TestPreviewScalesLargePNGsKeepingTransparency(t *testing.T) {
	dir := t.TempDir()
	opaque := filepath.Join(dir, "opaque.png")
	clearPNG := filepath.Join(dir, "clear.png")
	small := filepath.Join(dir, "small.png")
	writeFilledPNG(t, opaque, 400, 200, color.NRGBA{200, 10, 10, 255})
	writeFilledPNG(t, clearPNG, 400, 200, color.NRGBA{10, 10, 200, 0})
	writeFilledPNG(t, small, 80, 40, color.NRGBA{10, 200, 10, 255})

	typ, body := previewOf(t, opaque, "100")
	cfg, format, err := image.DecodeConfig(bytes.NewReader(body))
	if err != nil || typ != "image/jpeg" || format != "jpeg" || cfg.Width != 100 || cfg.Height != 50 {
		t.Fatalf("opaque: %s %s %+v %v, want a 100×50 JPEG", typ, format, cfg, err)
	}

	typ, body = previewOf(t, clearPNG, "100")
	img, format, err := image.Decode(bytes.NewReader(body))
	if err != nil || typ != "image/png" || format != "png" || img.Bounds().Dx() != 100 {
		t.Fatalf("transparent: %s %s %v, want a 100 px wide PNG", typ, format, err)
	}
	if _, _, _, a := img.At(50, 25).RGBA(); a != 0 {
		t.Fatalf("transparent preview has alpha %d, want 0", a)
	}

	original, _ := os.ReadFile(small)
	if typ, body = previewOf(t, small, "100"); typ != "image/png" || !bytes.Equal(body, original) {
		t.Fatalf("small: %s, %d bytes, want the file as it is", typ, len(body))
	}
}
