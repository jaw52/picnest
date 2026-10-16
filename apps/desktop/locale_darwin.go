package main

// systemLanguages lists the languages set in System Settings, most
// preferred first, as BCP 47 tags such as "zh-Hans-CN" or "en-US".
func systemLanguages() []string {
	if err := loadObjC(); err != nil {
		return nil
	}
	defer pushPool()()

	sel := objc.RegisterSel
	list := objc.Send(objc.GetClass("NSLocale"), sel("preferredLanguages"))
	n := objc.SendCount(list, sel("count"))
	tags := make([]string, 0, n)
	for i := range n {
		tags = append(tags, nsStringValue(objc.SendIndex(list, sel("objectAtIndex:"), i)))
	}
	return tags
}
