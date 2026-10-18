package main

import (
	"fmt"

	"github.com/egoist/mygo"
	"github.com/egoist/mygo/plugins/updater"
)

// messages is the text the Go side shows, in one language: the menu bar,
// native dialogs' buttons, and errors the page shows as they are.
// Formats take the file name first.
type messages struct {
	about, checkForUpdates, settings, services, hide       string
	hideOthers, showAll, quit                              string
	file, closeWindow                                      string
	edit, undo, redo, cut, copy, paste, pasteAndMatchStyle string
	delete, selectAll, speech, startSpeaking, stopSpeaking string
	view, reload, forceReload, devTools, fullScreen        string
	window, minimize, zoom, bringAllToFront                string

	ok, cancel string

	cannotTrash, iCloudMacOnly, invalidName, sameFolder string
	fileFailed, existsNotRestored, ratingNotRestored    string
	nameTaken, existsInDestination, recordsNotMoved     string

	libraryNoAccess, libraryPhotoGone, libraryNoImage, libraryReadOnly, libraryNotDeleted string

	collectTip string
}

var catalogs = map[Language]*messages{
	LanguageChinese: {
		about:              "关于 %s",
		checkForUpdates:    "检查更新…",
		settings:           "设置…",
		services:           "服务",
		hide:               "隐藏 %s",
		hideOthers:         "隐藏其他",
		showAll:            "全部显示",
		quit:               "退出 %s",
		file:               "文件",
		closeWindow:        "关闭窗口",
		edit:               "编辑",
		undo:               "撤销",
		redo:               "重做",
		cut:                "剪切",
		copy:               "拷贝",
		paste:              "粘贴",
		pasteAndMatchStyle: "粘贴并匹配样式",
		delete:             "删除",
		selectAll:          "全选",
		speech:             "语音",
		startSpeaking:      "开始朗读",
		stopSpeaking:       "停止朗读",
		view:               "显示",
		reload:             "重新载入",
		forceReload:        "强制重新载入",
		devTools:           "开发者工具",
		fullScreen:         "切换全屏幕",
		window:             "窗口",
		minimize:           "最小化",
		zoom:               "缩放",
		bringAllToFront:    "前置全部窗口",

		ok:     "确定",
		cancel: "取消",

		libraryNoAccess:   "Picnest 没有访问照片图库的权限",
		libraryPhotoGone:  "这张照片已不在照片图库中",
		libraryNoImage:    "无法读取这张照片",
		libraryReadOnly:   "照片图库中的照片不能重命名或移动",
		libraryNotDeleted: "无法从照片图库删除这些照片",

		collectTip: "把网页上的图片拖到这里收藏",

		cannotTrash:         "无法移到废纸篓",
		iCloudMacOnly:       "只有 macOS 支持下载 iCloud 文件",
		invalidName:         "文件名不能为空或包含斜杠",
		sameFolder:          "目标文件夹与当前文件夹相同",
		fileFailed:          "「%s」：%v",
		existsNotRestored:   "「%s」已存在，未能放回",
		ratingNotRestored:   "「%s」评分未能恢复：%v",
		nameTaken:           "「%s」已存在",
		existsInDestination: "「%s」在目标文件夹中已存在",
		recordsNotMoved:     "「%s」元数据迁移失败：%v",
	},
	LanguageEnglish: {
		about:              "About %s",
		checkForUpdates:    "Check for Updates…",
		settings:           "Settings…",
		services:           "Services",
		hide:               "Hide %s",
		hideOthers:         "Hide Others",
		showAll:            "Show All",
		quit:               "Quit %s",
		file:               "File",
		closeWindow:        "Close Window",
		edit:               "Edit",
		undo:               "Undo",
		redo:               "Redo",
		cut:                "Cut",
		copy:               "Copy",
		paste:              "Paste",
		pasteAndMatchStyle: "Paste and Match Style",
		delete:             "Delete",
		selectAll:          "Select All",
		speech:             "Speech",
		startSpeaking:      "Start Speaking",
		stopSpeaking:       "Stop Speaking",
		view:               "View",
		reload:             "Reload",
		forceReload:        "Force Reload",
		devTools:           "Developer Tools",
		fullScreen:         "Toggle Full Screen",
		window:             "Window",
		minimize:           "Minimize",
		zoom:               "Zoom",
		bringAllToFront:    "Bring All to Front",

		ok:     "OK",
		cancel: "Cancel",

		libraryNoAccess:   "Picnest doesn't have access to the Photos library",
		libraryPhotoGone:  "This photo is no longer in the Photos library",
		libraryNoImage:    "Couldn't read this photo",
		libraryReadOnly:   "Photos in the Photos library can't be renamed or moved",
		libraryNotDeleted: "Couldn't delete these photos from the Photos library",

		collectTip: "Drag a picture from a web page here to collect it",

		cannotTrash:         "Couldn't move it to the Trash",
		iCloudMacOnly:       "Downloading iCloud files needs macOS",
		invalidName:         "A file name can't be empty or contain a slash",
		sameFolder:          "That's the folder it's already in",
		fileFailed:          "“%s”: %v",
		existsNotRestored:   "“%s” already exists, so it stays in the Trash",
		ratingNotRestored:   "Couldn't restore the rating of “%s”: %v",
		nameTaken:           "“%s” already exists",
		existsInDestination: "“%s” already exists in that folder",
		recordsNotMoved:     "Couldn't move the ratings of “%s”: %v",
	},
}

// text returns the messages of the language the app is shown in.
func text() *messages {
	return catalogs[languageState().Language]
}

// appMenu builds the menu bar in the app's language: the default one, plus
// Check for Updates and Settings, less View's page zoom (⌘= / ⌘- / ⌘0
// resize the grid's thumbnails instead).
func appMenu() *mygo.Menu {
	m := text()
	name := mygo.App.Name()
	return mygo.NewMenu([]*mygo.MenuItem{
		{Role: mygo.RoleAppMenu, Submenu: []*mygo.MenuItem{
			{Role: mygo.RoleAbout, Label: fmt.Sprintf(m.about, name)},
			{Label: m.checkForUpdates, Click: func(*mygo.MenuItem, *mygo.Window) { updater.CheckForUpdates() }},
			mygo.Separator(),
			{Label: m.settings, Accelerator: "Cmd+,", Click: func(_ *mygo.MenuItem, win *mygo.Window) { showSettings(win) }},
			mygo.Separator(),
			{Role: mygo.RoleServices, Label: m.services},
			mygo.Separator(),
			{Role: mygo.RoleHide, Label: fmt.Sprintf(m.hide, name)},
			{Role: mygo.RoleHideOthers, Label: m.hideOthers},
			{Role: mygo.RoleUnhide, Label: m.showAll},
			mygo.Separator(),
			{Role: mygo.RoleQuit, Label: fmt.Sprintf(m.quit, name)},
		}},
		{Role: mygo.RoleFileMenu, Label: m.file, Submenu: []*mygo.MenuItem{
			{Role: mygo.RoleClose, Label: m.closeWindow},
		}},
		{Role: mygo.RoleEditMenu, Label: m.edit, Submenu: []*mygo.MenuItem{
			{Role: mygo.RoleUndo, Label: m.undo},
			{Role: mygo.RoleRedo, Label: m.redo},
			mygo.Separator(),
			{Role: mygo.RoleCut, Label: m.cut},
			{Role: mygo.RoleCopy, Label: m.copy},
			{Role: mygo.RolePaste, Label: m.paste},
			{Role: mygo.RolePasteAndMatchStyle, Label: m.pasteAndMatchStyle},
			{Role: mygo.RoleDelete, Label: m.delete},
			{Role: mygo.RoleSelectAll, Label: m.selectAll},
			mygo.Separator(),
			{Label: m.speech, Submenu: []*mygo.MenuItem{
				{Role: mygo.RoleStartSpeaking, Label: m.startSpeaking},
				{Role: mygo.RoleStopSpeaking, Label: m.stopSpeaking},
			}},
		}},
		{Label: m.view, Submenu: []*mygo.MenuItem{
			{Role: mygo.RoleReload, Label: m.reload},
			{Role: mygo.RoleForceReload, Label: m.forceReload},
			{Role: mygo.RoleToggleDevTools, Label: m.devTools},
			mygo.Separator(),
			{Role: mygo.RoleToggleFullScreen, Label: m.fullScreen},
		}},
		{Role: mygo.RoleWindowMenu, Label: m.window, Submenu: []*mygo.MenuItem{
			{Role: mygo.RoleMinimize, Label: m.minimize},
			{Role: mygo.RoleZoom, Label: m.zoom},
			mygo.Separator(),
			{Role: mygo.RoleFront, Label: m.bringAllToFront},
		}},
	})
}
