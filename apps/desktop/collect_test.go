package main

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

func TestOriginalCandidates(t *testing.T) {
	tests := []struct {
		name, in string
		want     []string
	}{
		{
			"tweet photo",
			"https://pbs.twimg.com/media/GabcDEF123?format=jpg&name=small",
			[]string{
				"https://pbs.twimg.com/media/GabcDEF123?format=jpg&name=orig",
				"https://pbs.twimg.com/media/GabcDEF123?format=png&name=orig",
				"https://pbs.twimg.com/media/GabcDEF123?format=jpg&name=small",
			},
		},
		{
			"tweet photo as WebP",
			"https://pbs.twimg.com/media/GabcDEF123?format=webp&name=900x900",
			[]string{
				"https://pbs.twimg.com/media/GabcDEF123?format=jpg&name=orig",
				"https://pbs.twimg.com/media/GabcDEF123?format=png&name=orig",
				"https://pbs.twimg.com/media/GabcDEF123?format=webp&name=900x900",
			},
		},
		{
			"older tweet photo address",
			"https://pbs.twimg.com/media/GabcDEF123.jpg:large",
			[]string{"https://pbs.twimg.com/media/GabcDEF123.jpg:orig", "https://pbs.twimg.com/media/GabcDEF123.jpg:large"},
		},
		{
			"pin",
			"https://i.pinimg.com/236x/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.jpg",
			[]string{
				"https://i.pinimg.com/originals/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.jpg",
				"https://i.pinimg.com/originals/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.png",
				"https://i.pinimg.com/originals/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.gif",
				"https://i.pinimg.com/1200x/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.jpg",
				"https://i.pinimg.com/236x/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.jpg",
			},
		},
		{
			"pixiv thumbnail",
			"https://i.pximg.net/c/250x250_80_a2/img-master/img/2024/05/01/12/34/56/118000000_p1_square1200.jpg",
			[]string{
				"https://i.pximg.net/img-original/img/2024/05/01/12/34/56/118000000_p1.jpg",
				"https://i.pximg.net/img-original/img/2024/05/01/12/34/56/118000000_p1.png",
				"https://i.pximg.net/img-original/img/2024/05/01/12/34/56/118000000_p1.gif",
				"https://i.pximg.net/img-master/img/2024/05/01/12/34/56/118000000_p1_master1200.jpg",
				"https://i.pximg.net/c/250x250_80_a2/img-master/img/2024/05/01/12/34/56/118000000_p1_square1200.jpg",
			},
		},
		{"any other site", "https://example.com/a/b.png?w=300", []string{"https://example.com/a/b.png?w=300"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := originalCandidates(tt.in); !slices.Equal(got, tt.want) {
				t.Errorf("originalCandidates(%q)\n got %q\nwant %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestDropAddressesAndPage(t *testing.T) {
	tests := []struct {
		name            string
		drop            droppedImage
		wantImage, page string
	}{
		{
			"tweet photo in its link",
			droppedImage{
				URL:  "https://x.com/someone/status/1790000000000000000/photo/1",
				HTML: `<a href="https://x.com/someone/status/1790000000000000000/photo/1"><img alt="Image" src="https://pbs.twimg.com/media/GabcDEF123?format=jpg&amp;name=small"></a>`,
			},
			"https://pbs.twimg.com/media/GabcDEF123?format=jpg&name=small",
			"https://x.com/someone/status/1790000000000000000",
		},
		{
			"tweet photo dragged out of Chrome",
			droppedImage{
				URL:  "https://x.com/someone/status/2107773824418845066/photo/1",
				HTML: `<img alt="Image" draggable="true" src="https://pbs.twimg.com/media/HUBQ48fXMAA6dww?format=jpg&amp;name=medium">`,
			},
			"https://pbs.twimg.com/media/HUBQ48fXMAA6dww?format=jpg&name=medium",
			"https://x.com/someone/status/2107773824418845066",
		},
		{
			"the page the drag started on wins",
			droppedImage{
				URL:       "https://i.pinimg.com/236x/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.jpg",
				SourceURL: "https://www.pinterest.com/pin/123/",
			},
			"https://i.pinimg.com/236x/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.jpg",
			"https://www.pinterest.com/pin/123/",
		},
		{
			"pixiv work linked from the ranking, out of WebKit's archive",
			droppedImage{
				URL:              "https://www.pixiv.net/artworks/150858693",
				SourceURL:        "https://www.pixiv.net/ranking.php",
				HTML:             `<a href="/artworks/150858693"><img src="https://i.pximg.net/c/480x960/img-master/img/2026/10/15/00/00/23/150858693_p0_master1200.jpg"></a>`,
				ArchivedImageURL: "https://i.pximg.net/c/480x960/img-master/img/2026/10/15/00/00/23/150858693_p0_master1200.jpg",
			},
			"https://i.pximg.net/c/480x960/img-master/img/2026/10/15/00/00/23/150858693_p0_master1200.jpg",
			"https://www.pixiv.net/artworks/150858693",
		},
		{
			"a link to another site is not the source",
			droppedImage{
				SourceURL: "https://blog.example.com/post",
				HTML:      `<a href="https://shop.example.net/item"><img src="https://blog.example.com/a.jpg"></a>`,
			},
			"https://blog.example.com/a.jpg",
			"https://blog.example.com/post",
		},
		{
			"picture only in the archive",
			droppedImage{URL: "https://example.com/page", ArchivedImageURL: "https://cdn.example.com/a.png"},
			"https://cdn.example.com/a.png",
			"https://example.com/page",
		},
		{
			"largest of a srcset",
			droppedImage{HTML: `<img src="https://e.com/s.jpg" srcset="https://e.com/s.jpg 300w, https://e.com/l.jpg 1200w, https://e.com/m.jpg 600w">`},
			"https://e.com/l.jpg",
			"",
		},
		{
			"pixiv work from the picture's address",
			droppedImage{URL: "https://i.pximg.net/c/250x250_80_a2/img-master/img/2024/05/01/12/34/56/118000000_p0_square1200.jpg"},
			"https://i.pximg.net/c/250x250_80_a2/img-master/img/2024/05/01/12/34/56/118000000_p0_square1200.jpg",
			"https://www.pixiv.net/artworks/118000000",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			image, link := dropAddresses(tt.drop)
			image, link = resolveAgainst(tt.drop.SourceURL, image), resolveAgainst(tt.drop.SourceURL, link)
			if image != tt.wantImage {
				t.Errorf("image = %q, want %q", image, tt.wantImage)
			}
			if got := pageURL(tt.drop.SourceURL, link, image); got != tt.page {
				t.Errorf("page = %q, want %q", got, tt.page)
			}
		})
	}
}

func TestImageFileName(t *testing.T) {
	tests := []struct{ url, mime, want string }{
		{"https://pbs.twimg.com/media/GabcDEF123?format=png&name=orig", "image/png", "GabcDEF123.png"},
		{"https://pbs.twimg.com/media/GabcDEF123.jpg:orig", "image/jpeg", "GabcDEF123.jpg"},
		{"https://i.pinimg.com/originals/0a/1b/2c/0a1b2c3d4e5f60718293a4b5c6d7e8f9.png", "image/png", "0a1b2c3d4e5f60718293a4b5c6d7e8f9.png"},
		{"https://i.pximg.net/img-original/img/2024/05/01/12/34/56/118000000_p2.png", "image/png", "118000000_p2.png"},
		{"https://example.com/photos/sunset.webp?w=300", "image/webp", "sunset.webp"},
		{"https://example.com/render", "image/jpeg", "render.jpg"},
		{"", "", "image.jpg"},
	}
	for _, tt := range tests {
		if got := imageFileName(tt.url, tt.mime); got != tt.want {
			t.Errorf("imageFileName(%q, %q) = %q, want %q", tt.url, tt.mime, got, tt.want)
		}
	}
}

func TestWriteUniqueNumbersTakenNames(t *testing.T) {
	dir := t.TempDir()
	for _, want := range []string{"a.jpg", "a 2.jpg", "a 3.jpg"} {
		got, err := writeUnique(dir, "a.jpg", []byte("x"))
		if err != nil {
			t.Fatal(err)
		}
		if filepath.Base(got) != want {
			t.Errorf("got %s, want %s", filepath.Base(got), want)
		}
	}
}

func TestSaveDroppedFallsBackToShownPicture(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	png, err := os.ReadFile(filepath.Join("resources", "icon.png"))
	if err != nil {
		t.Skip("no PNG at hand:", err)
	}
	if err := (&App{}).SetCollectTarget(t.TempDir()); err != nil {
		t.Fatal(err)
	}
	// An address that serves no picture: what the page showed is kept.
	saved, source, err := saveDropped(t.Context(), droppedImage{
		URL:      "http://127.0.0.1:1/missing.png",
		Data:     png,
		DataType: "public.png",
	})
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(saved) != "missing.png" {
		t.Errorf("saved as %s", filepath.Base(saved))
	}
	if source.DroppedURL != "http://127.0.0.1:1/missing.png" {
		t.Errorf("source = %+v", source)
	}
	db, err := openRatingsDB(filepath.Dir(saved))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var dropped string
	if err := db.QueryRow("SELECT dropped_url FROM sources WHERE file_name = ?", "missing.png").Scan(&dropped); err != nil {
		t.Fatal(err)
	}
	if dropped != source.DroppedURL {
		t.Errorf("recorded %q", dropped)
	}
}

func TestCollectTarget(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	a := &App{}
	picked := t.TempDir()
	if err := a.SetCollectTarget(picked); err != nil {
		t.Fatal(err)
	}
	if got := a.CollectTarget(); got != picked {
		t.Errorf("target = %s, want %s", got, picked)
	}
	// A picked folder gone from disk is no target.
	os.Remove(picked)
	if got := a.CollectTarget(); got != "" {
		t.Errorf("target = %s for a folder gone", got)
	}
	if _, _, err := saveDropped(t.Context(), droppedImage{URL: "http://127.0.0.1:1/x.png"}); !errors.Is(err, errNoTarget) {
		t.Errorf("err = %v, want errNoTarget", err)
	}
}
