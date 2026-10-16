package main

import (
	"bytes"
	"encoding/xml"

	"golang.org/x/sys/unix"
)

// whereFromsAttr is where macOS keeps the addresses a downloaded file came
// from, which Finder's Get Info shows as Where From; Safari writes it too.
const whereFromsAttr = "com.apple.metadata:kMDItemWhereFroms"

// setWhereFroms notes the addresses a file came from, the empty ones left
// out, as a property list of strings.
func setWhereFroms(path string, urls ...string) error {
	var b bytes.Buffer
	b.WriteString(xml.Header)
	b.WriteString(`<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">` + "\n")
	b.WriteString("<plist version=\"1.0\"><array>")
	n := 0
	for _, u := range urls {
		if u == "" {
			continue
		}
		n++
		b.WriteString("<string>")
		if err := xml.EscapeText(&b, []byte(u)); err != nil {
			return err
		}
		b.WriteString("</string>")
	}
	b.WriteString("</array></plist>\n")
	if n == 0 {
		return nil
	}
	return unix.Setxattr(path, whereFromsAttr, b.Bytes(), 0)
}
