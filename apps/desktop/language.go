package main

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"sync"

	"github.com/egoist/mygo"
)

// Language is a language the app is translated into.
type Language string

const (
	LanguageChinese Language = "zh-CN"
	LanguageEnglish Language = "en"
)

// LanguagePreference is the language picked in Settings: one of the
// app's languages, or whichever the system prefers.
type LanguagePreference string

const (
	PreferSystem  LanguagePreference = "system"
	PreferChinese LanguagePreference = "zh-CN"
	PreferEnglish LanguagePreference = "en"
)

// LanguageState is the language picked in Settings and the one the app is
// shown in because of it.
type LanguageState struct {
	Preference LanguagePreference `json:"preference"`
	Language   Language           `json:"language"`
}

// settings is what the Settings window changes, kept in settings.json.
type settings struct {
	Language LanguagePreference `json:"language"`
}

var language struct {
	sync.Mutex
	preference LanguagePreference
}

// loadLanguage reads the language picked in Settings. Without one, the app
// follows the system.
func loadLanguage() {
	language.Lock()
	defer language.Unlock()
	language.preference = PreferSystem
	path, err := configFile("settings.json")
	if err != nil {
		return
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	var s settings
	if json.Unmarshal(data, &s) == nil && validPreference(s.Language) {
		language.preference = s.Language
	}
}

func validPreference(p LanguagePreference) bool {
	return p == PreferSystem || p == PreferChinese || p == PreferEnglish
}

func languageState() LanguageState {
	language.Lock()
	preference := language.preference
	language.Unlock()
	return LanguageState{Preference: preference, Language: resolveLanguage(preference, systemLanguages())}
}

// resolveLanguage picks the language the app is shown in: the one picked,
// or the first of the system's preferred languages the app is translated
// into, or English.
func resolveLanguage(preference LanguagePreference, system []string) Language {
	switch preference {
	case PreferChinese:
		return LanguageChinese
	case PreferEnglish:
		return LanguageEnglish
	}
	for _, tag := range system {
		switch strings.ToLower(strings.SplitN(tag, "-", 2)[0]) {
		case "zh":
			return LanguageChinese
		case "en":
			return LanguageEnglish
		}
	}
	return LanguageEnglish
}

// GetLanguage reports the language picked in Settings and the one the app
// is shown in.
func (a *App) GetLanguage() LanguageState {
	return languageState()
}

// SetLanguage picks the app's language, translating the menu bar and every
// window's page.
func (a *App) SetLanguage(_ context.Context, preference LanguagePreference) (LanguageState, error) {
	if !validPreference(preference) {
		return LanguageState{}, errors.New("unknown language: " + string(preference))
	}
	path, err := configFile("settings.json")
	if err != nil {
		return LanguageState{}, err
	}
	data, err := json.Marshal(settings{Language: preference})
	if err != nil {
		return LanguageState{}, err
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return LanguageState{}, err
	}
	language.Lock()
	language.preference = preference
	language.Unlock()

	state := languageState()
	mygo.App.SetMenu(appMenu())
	for _, w := range mygo.Windows() {
		_ = languageChanged.Emit(w, state)
	}
	return state, nil
}

// showSettings asks the page of win, or of the focused window, to open
// Settings.
func showSettings(win *mygo.Window) {
	if win == nil {
		win = mygo.FocusedWindow()
	}
	if win == nil {
		if windows := mygo.Windows(); len(windows) > 0 {
			win = windows[0]
		}
	}
	if win != nil {
		_ = openSettings.Emit(win, struct{}{})
	}
}
