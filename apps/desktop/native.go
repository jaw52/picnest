package main

import (
	"context"

	"github.com/egoist/mygo"
)

// Native exposes system dialogs, the clipboard and Finder to the frontend.
type Native struct{}

// DialogKind selects the icon of a message dialog.
type DialogKind string

const (
	DialogInfo    DialogKind = "info"
	DialogWarning DialogKind = "warning"
	DialogError   DialogKind = "error"
)

// PickFolder asks for a directory; it returns "" when canceled.
func (Native) PickFolder(ctx context.Context, title, defaultPath string) (string, error) {
	paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Parent:            mygo.CallerWindow(ctx),
		Title:             title,
		DefaultPath:       defaultPath,
		Directory:         true,
		CreateDirectories: true,
	})
	if err != nil || len(paths) == 0 {
		return "", err
	}
	return paths[0], nil
}

// Ask shows a confirm/cancel dialog and reports whether the user confirmed.
func (Native) Ask(ctx context.Context, title, message string, kind DialogKind) (bool, error) {
	typ := mygo.MessageQuestion
	if kind == DialogWarning {
		typ = mygo.MessageWarning
	}
	res, err := mygo.Dialog.Message(mygo.MessageOptions{
		Parent:        mygo.CallerWindow(ctx),
		Type:          typ,
		Title:         title,
		Message:       message,
		Buttons:       []string{text().ok, text().cancel},
		DefaultButton: 0,
		CancelButton:  1,
	})
	return err == nil && res.Button == 0, err
}

// Message shows a dialog with a single OK button.
func (Native) Message(ctx context.Context, title, message string, kind DialogKind) error {
	typ := mygo.MessageInfo
	switch kind {
	case DialogWarning:
		typ = mygo.MessageWarning
	case DialogError:
		typ = mygo.MessageError
	}
	_, err := mygo.Dialog.Message(mygo.MessageOptions{
		Parent:  mygo.CallerWindow(ctx),
		Type:    typ,
		Title:   title,
		Message: message,
	})
	return err
}

func (Native) WriteText(text string) {
	mygo.Clipboard.WriteText(text)
}

// OpenPath opens a file or folder with its default app - a folder opens in
// Finder.
func (Native) OpenPath(path string) error {
	return mygo.Shell.OpenPath(path)
}
