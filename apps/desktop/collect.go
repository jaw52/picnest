package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"fmt"
	"html"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"
)

// Collecting: pictures dragged out of a web page onto the menu bar icon, or
// the panel it opens, are saved into the folder picked in the panel - one
// the user added - in the largest size the site keeps, with where they came
// from.

// maxCollectedBytes bounds a download: no picture a site serves comes near.
const maxCollectedBytes = 256 << 20

// downloadTimeout bounds each try at a picture's address. Originals run to
// megabytes, which a slow link, or a CDN fetching one it hasn't cached,
// takes half a minute or more to bring.
const downloadTimeout = 3 * time.Minute

// headerTimeout bounds the wait for a host to start answering, so an
// address that serves nothing gives way to the next one soon.
const headerTimeout = 20 * time.Second

var downloadClient = &http.Client{Transport: func() http.RoundTripper {
	t := http.DefaultTransport.(*http.Transport).Clone()
	t.ResponseHeaderTimeout = headerTimeout
	return t
}()}

// browserUserAgent is sent with downloads, as some image hosts turn away
// clients that don't look like a browser.
const browserUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"

// collectChanged carries the collected pictures, newest first, to the panel.
var collectChanged = mygo.NewEvent[[]CollectItem]("collect-changed")

// CollectStatus is how far saving a dropped picture got.
type CollectStatus string

const (
	CollectSaving CollectStatus = "saving"
	CollectSaved  CollectStatus = "saved"
	CollectFailed CollectStatus = "failed"
)

// CollectItem is a picture dropped to be collected.
type CollectItem struct {
	ID     int           `json:"id"`
	Status CollectStatus `json:"status"`
	// Path is where it was saved, once it is.
	Path string `json:"path"`
	// PageURL is the page it was dragged from, when the drag told.
	PageURL string `json:"pageUrl"`
	// Error says why it could not be saved.
	Error string `json:"error"`
}

// droppedImage is what a drag of a picture out of a browser holds.
type droppedImage struct {
	// URL is the drag's URL: the picture's, or that of a link around it.
	URL string
	// HTML is the dragged markup, usually an <img>, maybe in an <a>.
	HTML string
	// SourceURL is the page the drag started on (Chromium and WebKit tell
	// it).
	SourceURL string
	// ArchivedImageURL is the address of the picture WebKit's web archive of
	// the drag holds.
	ArchivedImageURL string
	// File is a local file, dragged from Finder.
	File string
	// Data is the picture itself as the page showed it, and its UTI.
	Data     []byte
	DataType string
}

// collectSource is where a collected picture came from.
type collectSource struct {
	// ImageURL is the address it was downloaded from: the original's,
	// where the site has one.
	ImageURL string
	// DroppedURL is the address the page showed it from.
	DroppedURL string
	PageURL    string
}

// collectTargetFile keeps the folder the panel saves into.
const collectTargetFile = "collect-target"

// errNoTarget is a drop with no folder picked to save it in.
var errNoTarget = errors.New("no folder picked to save into")

// CollectTarget returns the folder the panel saves into, or "" when none is
// picked or it is gone.
func (a *App) CollectTarget() string { return collectTarget() }

// SetCollectTarget makes the panel save into dir; "" picks none.
func (a *App) SetCollectTarget(dir string) error {
	file, err := configFile(collectTargetFile)
	if err != nil {
		return err
	}
	if dir == "" {
		if err := os.Remove(file); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	}
	return os.WriteFile(file, []byte(dir), 0o644)
}

// collectTarget is the folder picked to save into, while it is still there.
func collectTarget() string {
	file, err := configFile(collectTargetFile)
	if err != nil {
		return ""
	}
	data, err := os.ReadFile(file)
	if err != nil {
		return ""
	}
	dir := string(data)
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		return ""
	}
	return dir
}

// collector keeps the pictures dropped since the app started, for the panel.
type collector struct {
	mu     sync.Mutex
	items  []CollectItem
	nextID int
	// onChange hears every change, after it is made.
	onChange func([]CollectItem)
}

var collected = &collector{}

// CollectedItems returns the pictures dropped since the app started,
// newest first.
func (a *App) CollectedItems() []CollectItem { return collected.snapshot() }

func (c *collector) snapshot() []CollectItem {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]CollectItem(nil), c.items...)
}

func (c *collector) update(id int, change func(*CollectItem)) {
	c.mu.Lock()
	for i := range c.items {
		if c.items[i].ID == id {
			change(&c.items[i])
		}
	}
	items := append([]CollectItem(nil), c.items...)
	onChange := c.onChange
	c.mu.Unlock()
	if onChange != nil {
		onChange(items)
	}
}

// collect saves a dropped picture in the background, listing it at once.
func (c *collector) collect(drop droppedImage) {
	c.mu.Lock()
	c.nextID++
	id := c.nextID
	c.items = append([]CollectItem{{ID: id, Status: CollectSaving}}, c.items...)
	c.mu.Unlock()
	c.update(id, func(*CollectItem) {})
	go func() {
		saved, source, err := saveDropped(context.Background(), drop)
		c.update(id, func(item *CollectItem) {
			item.PageURL = source.PageURL
			if err != nil {
				item.Status = CollectFailed
				item.Error = err.Error()
				return
			}
			item.Status = CollectSaved
			item.Path = saved
		})
	}()
}

// saveDropped saves a dropped picture into the folder picked in the panel
// and records where it came from.
func saveDropped(ctx context.Context, drop droppedImage) (string, collectSource, error) {
	dir := collectTarget()
	if dir == "" {
		return "", collectSource{}, errNoTarget
	}
	imageURL, linkURL := dropAddresses(drop)
	imageURL, linkURL = resolveAgainst(drop.SourceURL, imageURL), resolveAgainst(drop.SourceURL, linkURL)
	source := collectSource{DroppedURL: imageURL, PageURL: pageURL(drop.SourceURL, linkURL, imageURL)}

	var data []byte
	var err error
	var name string
	switch {
	case drop.File != "":
		data, err = os.ReadFile(drop.File)
		name = filepath.Base(drop.File)
	case strings.HasPrefix(imageURL, "data:"):
		var mimeType string
		data, mimeType, err = decodeDataURL(imageURL)
		name = "image" + extensionFor(mimeType, "")
		source.DroppedURL = ""
	case imageURL != "":
		var got string
		data, got, err = downloadOriginal(ctx, imageURL)
		source.ImageURL = got
		if err == nil {
			name = imageFileName(got, http.DetectContentType(data))
		}
	default:
		err = errors.New("nothing to save")
	}
	// What the page showed is better than nothing.
	if err != nil && len(drop.Data) > 0 {
		data, err = drop.Data, nil
		name = imageFileName(imageURL, utiMIMEType(drop.DataType))
	}
	if err != nil {
		return "", source, err
	}

	dest, err := writeUnique(dir, name, data)
	if err != nil {
		return "", source, err
	}
	if err := setWhereFroms(dest, source.ImageURL, source.PageURL); err != nil {
		fmt.Fprintf(os.Stderr, "failed to note where %s came from: %v\n", dest, err)
	}
	if err := recordSource(dir, filepath.Base(dest), source); err != nil {
		fmt.Fprintf(os.Stderr, "failed to record where %s came from: %v\n", dest, err)
	}
	return dest, source, nil
}

var (
	imgSrcPattern = regexp.MustCompile(`(?is)<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']`)
	linkPattern   = regexp.MustCompile(`(?is)<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']`)
	srcsetPattern = regexp.MustCompile(`(?is)<img\b[^>]*?\bsrcset\s*=\s*["']([^"']+)["']`)
)

// dropAddresses picks the picture's address out of a drop, and the link
// around it, if any. Over a picture in a link, browsers give the link as
// the drag's URL, and the picture only in the markup.
func dropAddresses(drop droppedImage) (imageURL, linkURL string) {
	if m := srcsetPattern.FindStringSubmatch(drop.HTML); m != nil {
		imageURL = largestInSrcset(html.UnescapeString(m[1]))
	}
	if m := imgSrcPattern.FindStringSubmatch(drop.HTML); imageURL == "" && m != nil {
		imageURL = html.UnescapeString(m[1])
	}
	if m := linkPattern.FindStringSubmatch(drop.HTML); m != nil {
		linkURL = html.UnescapeString(m[1])
	}
	if imageURL == "" {
		imageURL = drop.ArchivedImageURL
	}
	switch {
	case imageURL == "":
		imageURL = drop.URL
	case drop.URL != "" && drop.URL != imageURL && linkURL == "":
		linkURL = drop.URL
	}
	return imageURL, linkURL
}

// resolveAgainst makes an address from the dragged markup absolute, as the
// page it was on would: markup copied from a page keeps relative links.
func resolveAgainst(page, ref string) string {
	base, err := url.Parse(page)
	if ref == "" || err != nil || base.Host == "" {
		return ref
	}
	u, err := base.Parse(ref)
	if err != nil {
		return ref
	}
	return u.String()
}

// largestInSrcset returns the candidate of a srcset with the largest width
// or density descriptor.
func largestInSrcset(srcset string) string {
	best, bestSize := "", -1.0
	for candidate := range strings.SplitSeq(srcset, ",") {
		fields := strings.Fields(candidate)
		if len(fields) == 0 {
			continue
		}
		size := 1.0
		if len(fields) > 1 {
			var n float64
			if _, err := fmt.Sscanf(strings.TrimRight(fields[1], "wx"), "%g", &n); err == nil {
				size = n
			}
		}
		if size > bestSize {
			best, bestSize = fields[0], size
		}
	}
	return best
}

var (
	tweetPath  = regexp.MustCompile(`^(/[^/]+/status/\d+)`)
	pixivMedia = regexp.MustCompile(`/img/(\d{4}/\d{2}/\d{2}/\d{2}/\d{2}/\d{2})/(\d+)_p(\d+)`)
)

// pageURL is the page a picture came from: the link around it on the page
// the drag started on - a tweet's, without the photo viewer's /photo/1, a
// pin's, a pixiv work's - or else that page itself, or for pixiv, the work
// the picture's address names. A link to another site is not where the
// picture came from, but where it leads.
func pageURL(source, link, image string) string {
	if u, err := url.Parse(link); err == nil && u.Host != "" && (source == "" || sameSite(u.Host, source)) {
		if host := strings.TrimPrefix(u.Host, "www."); host == "x.com" || host == "twitter.com" {
			if m := tweetPath.FindString(u.Path); m != "" {
				u.Path, u.RawQuery = m, ""
			}
		}
		return u.String()
	}
	if source != "" {
		return source
	}
	if u, err := url.Parse(image); err == nil && u.Host == "i.pximg.net" {
		if m := pixivMedia.FindStringSubmatch(u.Path); m != nil {
			return "https://www.pixiv.net/artworks/" + m[2]
		}
	}
	return ""
}

// sameSite reports whether host is the host of page, or of its site: as
// twitter.com is x.com's.
func sameSite(host, page string) bool {
	p, err := url.Parse(page)
	if err != nil {
		return false
	}
	site := func(h string) string {
		h = strings.TrimPrefix(h, "www.")
		if h == "twitter.com" {
			return "x.com"
		}
		return h
	}
	return site(host) == site(p.Host)
}

// originalCandidates lists the addresses to try for the largest copy of a
// picture, best first, ending with the address it was dropped from: sites
// serve smaller copies to pages, under addresses that name the original's.
func originalCandidates(raw string) []string {
	u, err := url.Parse(raw)
	if err != nil {
		return []string{raw}
	}
	var out []string
	switch u.Host {
	case "pbs.twimg.com":
		out = twitterOriginals(u)
	case "i.pinimg.com":
		out = pinterestOriginals(u)
	case "i.pximg.net":
		out = pixivOriginals(u)
	}
	seen := map[string]bool{}
	var unique []string
	for _, c := range append(out, raw) {
		if !seen[c] {
			seen[c] = true
			unique = append(unique, c)
		}
	}
	return unique
}

// twitterOriginals: pbs.twimg.com/media/<id>?format=jpg&name=small serves
// the upload itself, up to 4096px, as name=orig. Older addresses put the
// size after a colon: /media/<id>.jpg:large.
func twitterOriginals(u *url.URL) []string {
	o := *u
	if base, _, ok := strings.Cut(o.Path, ":"); ok {
		o.Path = base + ":orig"
		return []string{o.String()}
	}
	q := o.Query()
	if q.Get("name") == "" && q.Get("format") == "" {
		return nil
	}
	format := q.Get("format")
	if format == "" {
		format = strings.TrimPrefix(path.Ext(o.Path), ".")
	}
	var out []string
	// A WebP copy has no original of its own: the upload is a JPEG or PNG.
	for _, f := range []string{format, "jpg", "png"} {
		if f == "" || f == "webp" {
			continue
		}
		q.Set("format", f)
		q.Set("name", "orig")
		o.RawQuery = q.Encode()
		out = append(out, o.String())
	}
	return out
}

// pinterestOriginals: i.pinimg.com/<size>/ab/cd/ef/<hash>.jpg has the
// upload under /originals/, keeping its own extension, which the copies'
// .jpg may not be; failing that, the largest copy is 1200px wide.
func pinterestOriginals(u *url.URL) []string {
	size, rest, ok := strings.Cut(strings.TrimPrefix(u.Path, "/"), "/")
	if !ok || size == "originals" {
		return nil
	}
	stem := strings.TrimSuffix(rest, path.Ext(rest))
	var out []string
	for _, p := range []string{
		"/originals/" + rest,
		"/originals/" + stem + ".png",
		"/originals/" + stem + ".gif",
		"/1200x/" + rest,
	} {
		o := *u
		o.Path, o.RawQuery = p, ""
		out = append(out, o.String())
	}
	return out
}

// pixivOriginals: i.pximg.net/c/<size>/img-master/img/<date>/<id>_p0_master1200.jpg
// (or custom-thumb/..._custom1200.jpg, ..._square1200.jpg) has the upload at
// /img-original/img/<date>/<id>_p0.<ext>, a JPEG, PNG or GIF; the largest
// copy is the 1200px master.
func pixivOriginals(u *url.URL) []string {
	m := pixivMedia.FindStringSubmatch(u.Path)
	if m == nil {
		return nil
	}
	date, id, page := m[1], m[2], m[3]
	var out []string
	for _, ext := range []string{"jpg", "png", "gif"} {
		out = append(out, fmt.Sprintf("https://i.pximg.net/img-original/img/%s/%s_p%s.%s", date, id, page, ext))
	}
	return append(out, fmt.Sprintf("https://i.pximg.net/img-master/img/%s/%s_p%s_master1200.jpg", date, id, page))
}

// referer is the page a host wants a request to come from: pixiv serves
// pictures only to its own pages.
func referer(raw string) string {
	if u, err := url.Parse(raw); err == nil && u.Host == "i.pximg.net" {
		return "https://www.pixiv.net/"
	}
	return ""
}

// downloadOriginal downloads the first of a picture's candidate addresses
// that serves a picture, and says which it was.
func downloadOriginal(ctx context.Context, raw string) ([]byte, string, error) {
	var errs []error
	for _, candidate := range originalCandidates(raw) {
		data, err := download(ctx, candidate)
		if err == nil {
			return data, candidate, nil
		}
		errs = append(errs, err)
	}
	return nil, "", errors.Join(errs...)
}

func download(ctx context.Context, raw string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, downloadTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, http.NoBody)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", browserUserAgent)
	req.Header.Set("Accept", "image/avif,image/webp,image/png,image/*;q=0.8,*/*;q=0.5")
	if r := referer(raw); r != "" {
		req.Header.Set("Referer", r)
	}
	resp, err := downloadClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s: %s", raw, resp.Status)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxCollectedBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) > maxCollectedBytes {
		return nil, fmt.Errorf("%s: too large", raw)
	}
	// Some hosts answer a missing picture with a page.
	if !strings.HasPrefix(http.DetectContentType(data), "image/") && !isAVIFOrHEIC(data) {
		return nil, fmt.Errorf("%s: not a picture", raw)
	}
	return data, nil
}

// isAVIFOrHEIC reports an ISO media file, which DetectContentType doesn't
// know as a picture.
func isAVIFOrHEIC(data []byte) bool {
	return len(data) >= 12 && string(data[4:8]) == "ftyp" && slices.Contains([]string{"avif", "avis", "heic", "heix", "mif1"}, string(data[8:12]))
}

func decodeDataURL(raw string) ([]byte, string, error) {
	meta, payload, ok := strings.Cut(strings.TrimPrefix(raw, "data:"), ",")
	if !ok {
		return nil, "", errors.New("malformed data URL")
	}
	mimeType, _, _ := strings.Cut(meta, ";")
	if strings.HasSuffix(meta, ";base64") {
		data, err := base64.StdEncoding.DecodeString(payload)
		return data, mimeType, err
	}
	text, err := url.PathUnescape(payload)
	return []byte(text), mimeType, err
}

var (
	pinterestHash = regexp.MustCompile(`([0-9a-f]{32})`)
	unsafeName    = regexp.MustCompile(`[/\\:*?"<>|\x00-\x1f]+`)
)

// imageFileName names a picture saved from raw: by the identifier its site
// gives it - a tweet photo's media ID, a pin's hash, a pixiv work and page -
// or else the address's last segment, with the extension its content has.
func imageFileName(raw, mimeType string) string {
	stem := "image"
	if u, err := url.Parse(raw); err == nil {
		base := path.Base(u.Path)
		if b, _, ok := strings.Cut(base, ":"); ok {
			base = b
		}
		switch {
		case u.Host == "i.pinimg.com" && pinterestHash.MatchString(base):
			base = pinterestHash.FindString(base)
		case u.Host == "i.pximg.net":
			if m := pixivMedia.FindStringSubmatch(u.Path); m != nil {
				base = m[2] + "_p" + m[3]
			}
		}
		if s := strings.TrimSuffix(base, path.Ext(base)); s != "" && s != "." && s != "/" {
			stem = s
		}
		if mimeType == "" || mimeType == "application/octet-stream" {
			mimeType = mime.TypeByExtension(path.Ext(base))
		}
	}
	stem = strings.Trim(unsafeName.ReplaceAllString(stem, "-"), " .-")
	if stem == "" {
		stem = "image"
	}
	return stem + extensionFor(mimeType, ".jpg")
}

// extensionFor is the usual extension of a picture's MIME type.
func extensionFor(mimeType, fallback string) string {
	switch strings.ToLower(mimeType) {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "image/avif":
		return ".avif"
	case "image/heic":
		return ".heic"
	case "image/bmp":
		return ".bmp"
	case "image/tiff":
		return ".tiff"
	}
	return fallback
}

// utiMIMEType is the MIME type of an image UTI from the pasteboard.
func utiMIMEType(uti string) string {
	switch uti {
	case "public.png":
		return "image/png"
	case "public.jpeg":
		return "image/jpeg"
	case "public.tiff":
		return "image/tiff"
	case "com.compuserve.gif":
		return "image/gif"
	case "org.webmproject.webp":
		return "image/webp"
	}
	return ""
}

// writeUnique writes data to name in dir, numbering the name as Finder does
// if a file has it already.
func writeUnique(dir, name string, data []byte) (string, error) {
	ext := filepath.Ext(name)
	stem := strings.TrimSuffix(name, ext)
	for i := 1; ; i++ {
		candidate := name
		if i > 1 {
			candidate = fmt.Sprintf("%s %d%s", stem, i, ext)
		}
		dest := filepath.Join(dir, candidate)
		f, err := os.OpenFile(dest, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
		if errors.Is(err, os.ErrExist) {
			continue
		}
		if err != nil {
			return "", err
		}
		_, werr := f.Write(data)
		if cerr := f.Close(); werr == nil {
			werr = cerr
		}
		if werr != nil {
			os.Remove(dest)
			return "", werr
		}
		return dest, nil
	}
}

// recordSource keeps where a collected picture came from in the folder's
// sidecar database, which carries it along when the picture is renamed or
// moved to another folder.
func recordSource(dir, fileName string, s collectSource) error {
	db, err := openRatingsDB(dir)
	if err != nil {
		return err
	}
	defer db.Close()
	return setSource(db, fileName, s)
}

func setSource(db *sql.DB, fileName string, s collectSource) error {
	_, err := db.Exec(`INSERT INTO sources (file_name, page_url, image_url, dropped_url, collected_at) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(file_name) DO UPDATE SET page_url = excluded.page_url, image_url = excluded.image_url,
			dropped_url = excluded.dropped_url, collected_at = excluded.collected_at`,
		fileName, s.PageURL, s.ImageURL, s.DroppedURL, time.Now().Unix())
	return err
}
