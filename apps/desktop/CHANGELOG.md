# Changelog

## 0.6.0

### What's new / 新功能

- **Delete from the Photos library** — delete one or many photos in the Photos library, as in a folder. After you confirm them in Picnest, macOS asks once more, and the photos go to Recently Deleted in Photos, where they can be recovered for 30 days. Renaming and moving library photos are still left to Photos.
  **从照片图库删除**：在照片图库里也能像在文件夹里一样删除一张或多张照片。在 Picnest 里确认后，macOS 会再确认一次，照片会进入“照片”的“最近删除”，30 天内可以恢复。图库照片仍不能在这里重命名或移动。

## 0.5.0

### What's new / 新功能

- **Photos library** — open your Photos library in a tab from the new-tab page, and browse, preview and rate its photos. The library is read-only: renaming, moving and deleting are left to Photos.
  **照片图库**：在新标签页打开“照片”图库，可以浏览、预览和打分。图库只读，不能在这里重命名、移动或删除。
- **Group by date taken** — the grid can group photos by year, month or day, newest first, using the date each photo was taken.
  **按拍摄时间分组**：网格可以按年、月或日分组，最新的在前，按每张照片的拍摄时间排列。
- **Collect pictures from the web** — drag a picture out of a web page onto the menu bar icon or into its panel, and it is saved to a folder you pick there. Pictures from X, Pinterest and pixiv are saved at their original size, and where each came from is kept in the file's Where From.
  **收集网页图片**：把网页上的图片拖到菜单栏图标或它的面板上，就会存进你在面板里选的文件夹。X、Pinterest 和 pixiv 的图片会保存原图，来源记录在文件的“来源”信息里。
- **Tabs keep their place** — switching tabs is instant, and each tab keeps its scroll position, filter, selection and anything left open.
  **标签页各自保留状态**：切换标签页即时完成，每个标签页的滚动位置、筛选、选中和打开的面板都会保留。
- **Automatic updates** — Picnest checks for new versions once a day, and from Check for Updates… in the app menu. From this version on, updates install themselves.
  **自动更新**：Picnest 每天检查一次新版本，也可以在应用菜单里点“检查更新…”。从这个版本起，更新会自动安装。
- **Clear the photo cache** — Settings shows how much space thumbnails take and clears them. Ratings are kept.
  **清理照片缓存**：设置里会显示缩略图占用的空间，并可以一键清理，评分不受影响。
- **Tidier new-tab page** — it now shows just Library and Folders, with a card at the end of the folders to add one.
  **更简洁的新标签页**：只分“图库”和“文件夹”两组，添加文件夹的卡片放在文件夹末尾。
- **Faster previews** — photos open, switch and zoom more smoothly, HEIC photos from the library zoom in about six times faster, and thumbnails fill the screen sooner.
  **预览更快**：打开、切换和缩放照片更流畅，图库里的 HEIC 照片放大快了约六倍，缩略图也更快铺满屏幕。

### Fixes / 修复

- Portrait photos no longer lie on their side in the grid.
  修复竖拍照片在网格里横躺的问题。
- Reopening the Photos library while it was loading could crash the app.
  修复图库加载时重新打开可能闪退的问题。
- Opening a folder could show some of its photos twice.
  修复打开文件夹时部分照片重复显示的问题。

## 0.4.0

### What's new / 新功能

- **Procreate files** — `.procreate` files now show up alongside your photos, with a thumbnail and a full-size view from the preview Procreate saves inside each file. That preview is often smaller than the canvas.
  **支持 Procreate 文件**：`.procreate` 文件会和照片一起显示，缩略图和大图来自 Procreate 存在文件里的预览图（分辨率通常小于画布）。
- **iCloud files without downloading** — files still in iCloud now show their thumbnail and real shape, as in Finder, without being downloaded. You can rate them, and open them in the preview from that thumbnail, with a button to download the original.
  **未下载的 iCloud 文件**：和 Finder 一样，不下载也能显示缩略图和真实比例；可以直接打分，也能用缩略图打开预览，并一键下载原图。
- **New tab bar** — the selected tab now joins the page below it, and both the selection and the hover slide smoothly between tabs. Tabs show a folder or a cloud depending on whether the folder is on this Mac or in iCloud (including a Desktop or Documents folder synced to iCloud), and iCloud folders on the new-tab page carry a cloud on their cover.
  **全新标签栏**：选中的标签与下方页面连成一体，选中和悬停效果都会在标签间平滑滑动。标签会按文件夹所在位置显示文件夹或云朵图标（同步到 iCloud 的“桌面”“文稿”也算 iCloud），新标签页里的 iCloud 文件夹封面上也印有云朵。

### Fixes / 修复

- Switching tabs no longer makes the tab bar stretch or stutter.
  修复切换标签时标签栏突然拉伸、动画卡顿的问题。
