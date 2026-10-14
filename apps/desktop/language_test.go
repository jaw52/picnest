package main

import "testing"

func TestResolveLanguage(t *testing.T) {
	cases := []struct {
		preference LanguagePreference
		system     []string
		want       Language
	}{
		{PreferChinese, []string{"en-US"}, LanguageChinese},
		{PreferEnglish, []string{"zh-Hans-CN"}, LanguageEnglish},
		{PreferSystem, []string{"zh-Hans-CN", "en-US"}, LanguageChinese},
		{PreferSystem, []string{"zh-Hant-TW"}, LanguageChinese},
		{PreferSystem, []string{"en-GB", "zh-Hans-CN"}, LanguageEnglish},
		// The first language the app is translated into, past those it isn't.
		{PreferSystem, []string{"ja-JP", "zh-Hans-CN"}, LanguageChinese},
		{PreferSystem, []string{"ja-JP"}, LanguageEnglish},
		{PreferSystem, nil, LanguageEnglish},
	}
	for _, c := range cases {
		if got := resolveLanguage(c.preference, c.system); got != c.want {
			t.Errorf("resolveLanguage(%q, %q) = %q, want %q", c.preference, c.system, got, c.want)
		}
	}
}

func TestCatalogsAreComplete(t *testing.T) {
	for lang, m := range catalogs {
		for name, s := range map[string]string{
			"settings": m.settings, "quit": m.quit, "ok": m.ok, "cancel": m.cancel,
			"cannotTrash": m.cannotTrash, "fileFailed": m.fileFailed, "recordsNotMoved": m.recordsNotMoved,
		} {
			if s == "" {
				t.Errorf("%s: %s is empty", lang, name)
			}
		}
	}
}
