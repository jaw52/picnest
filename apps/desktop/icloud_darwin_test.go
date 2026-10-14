package main

import "testing"

func TestTempFolderIsNotICloud(t *testing.T) {
	if isICloudItem(t.TempDir()) {
		t.Fatal("a temp folder reads as iCloud")
	}
	if isICloudItem("/no/such/folder") {
		t.Fatal("a missing folder reads as iCloud")
	}
}
