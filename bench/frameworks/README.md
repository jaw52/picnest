# 框架基准：瀑布流 + 预览

用同一套逻辑，以 TSX 分别在 React、Solid、Vue 的最新稳定版上实现 Picnest 画廊的核心部分，再在系统 WKWebView（Picnest 实际运行的 WebKit）里以 120Hz 自动跑分。

## 实现了什么

每个 app 都有：3 个保持挂载的标签页，每页一个画廊，包括：

- 虚拟化瀑布流：与 `apps/desktop/frontend/src/lib/masonry.ts` 相同的布局算法；以 100px 为步长跟踪滚动位置，上下各多挂载一屏
- 格子：缩略图、文件名、五星评分按钮、选中描边
- 工具栏：评分筛选、缩略图尺寸滑块
- 预览：当前照片和左右邻居（缩略图打底、原图覆盖，预解码前后几张，同 `useDecodedImages`）、计数、虚拟化胶片条（自动滚到当前项）
- 键盘：方向键切换、Esc 关闭、Backspace 删除、1–5 评分、Cmd+A 全选、Cmd+点击切换选中

框架无关的部分都放在 `src/shared/`（数据、布局、规则、样式、测量），各框架目录只负责状态和渲染。每个框架都用**它自己跑得最快的写法**，而不是照搬同一种数据形态：

| 变体 | 写法 |
|---|---|
| `react` | React Compiler 1.0；照片列表是不可变数组；改过的评分放在组件外的 store，格子用 `useSyncExternalStore` 只订阅自己那张，评分时不重渲染整个网格；`memo` 格子；`<Activity>` 保持隐藏标签页 |
| `solid` | 照片列表是一个 signal 持有的普通数组（不给几千张照片建 store 代理）；改过的评分放在按 id 索引的 `createStore`，评分只更新那几颗星 |
| `vue` | Vue 3.5（虚拟 DOM）；照片列表放 `shallowRef`；改过的评分放在按 id 索引的 `reactive`，评分只重渲染那个格子 |

四者都只把**改过的**评分放进响应式状态，没改过的直接读照片自带的值：打开几千张的文件夹时不写任何响应式数据，评分时只动一个值。这是对比过几种写法后选出的：

- Solid 的 `createStore` 和 Vue 的深层 `ref` 直接包住整个照片列表，单项更新快，但每张照片都要建代理，打开 5000 张要多花 2–3 倍时间，JS 堆多 40%–150%
- 照片列表用不可变数组、评分也跟着整个替换，加载快，但评分会让整个网格重新计算
- 列表不可变、评分单独细粒度存储，两头都快

Vue 3.6 的 Vapor 模式（无虚拟 DOM）也测过：用 vue-jsx-vapor 写成同样的 TSX、同样的状态写法，结果和虚拟 DOM 版持平或略慢（瓶颈在响应式，不在 DOM 更新），又只是 RC，已经从对比中去掉。

`scripts/verify.ts` 用同一串操作驱动全部变体并比对 DOM，保证它们行为一致。

## 测什么

场景见 `src/shared/harness.ts`，全部通过真实 DOM 事件（点击、按键、`input`、滚动）驱动：

| 场景 | 内容 |
|---|---|
| load | 打开 5000 张照片的文件夹 |
| scroll | 每帧滚 40px 共 300 帧，再每帧甩 1500px 共 60 帧 |
| resize | 拖动缩略图尺寸滑块 11 档（全部重新布局） |
| filter | 评分筛选开/关 |
| rate | 在格子上评分（一个照片在几千个里变化） |
| select / toggle | Cmd+A 全选与清空、Cmd+点击切换单个 |
| open | 打开/关闭预览 |
| switch | 预览中方向键切换 60 次，每次等一帧 |
| burst | 按住方向键：每 8ms 一次，比帧更快 |
| delete | 预览中连续删除 |
| stream | 扫描流式追加：每帧 100 张，直到 5000 张 |
| tabs | 在三个保持挂载、各有 5000 张的标签页间切换 |
| churn | 开预览 → 切 10 张 → 关，循环 20 次，看内存是否回落 |

指标：

- **同步工作时间**：从触发到框架更新完 DOM、浏览器做完样式与布局（不含绘制，因为绘制受 vsync 限制，会把所有操作都取整到一帧）
- **到下一帧**：触发到下一帧产出，看是否掉帧
- **帧率**：滚动和连切时的平均 FPS、p95 帧间隔、卡顿帧占比（>25ms）
- **CPU**：页面渲染进程与全部浏览器进程的 CPU 时间（`ps`）；Chromium 另有 CDP 的主线程繁忙时间、长任务数
- **内存**：渲染进程 RSS；Chromium 另有强制 GC 后的 JS 堆、DOM 节点数
- **包体积**：gzip 后的 JS
- **启动**：导航开始到首帧

每轮都开全新页面，框架顺序每轮轮换，抵消缓存与发热的偏差。

## 运行

跑分默认在**系统的 WKWebView** 里进行：mygo 不是 Electron，Picnest 用的就是 macOS 自带的 WebKit。`scripts/wkdriver.swift` 开一个窗口放 WKWebView，像 Picnest 的 `apps/desktop/webview_darwin.go` 一样关掉 WebKit 的 60fps 限制，`run.ts` 通过它的 stdin/stdout 执行页面里的场景。

```sh
bun install
swiftc -O scripts/wkdriver.swift -o .build/wkdriver
bun run images      # 生成 48 张测试图到 public/img（缩略图 480px、原图 2400px）
bun run build       # 构建全部变体到 dist/
node scripts/verify.ts   # 需要 bunx playwright install chromium
node scripts/run.ts --headed   # 默认：WKWebView × 4 个框架 × 真实图片/纯色块 × 5 轮
```

跑的时候窗口浮在最上层、关掉了 App Nap，可以照常用电脑；单轮卡住超过 3 分钟会自动重跑一次。

### 用本机图库的真实照片

`scripts/export-photos.swift` 通过 PhotoKit（Picnest 读图库也用它）**只读**导出最近的照片：1000 张 512px 缩略图，其中前 200 张另导出屏幕尺寸的预览图，外加宽高清单，写到 `public/real/`（已 gitignore，不提交）。它从不修改、增删图库里的照片；只读取本机已有的照片，不从 iCloud 下载；也不导出文件名、日期、地点。要以独立 app 的身份申请照片权限，所以打包成 app 后再启动：

```sh
swiftc -O scripts/export-photos.swift -o .build/export-photos -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker scripts/export-photos.plist
# 打包为 .build/ExportPhotos.app（Info.plist 取自 scripts/export-photos.plist）后：
open -W -n .build/ExportPhotos.app --args "$PWD/public/real" 1000 200
node scripts/run.ts --headed --src real --n 1000 --img 1
rm -rf public/real   # 用完删掉导出的副本
```

常用参数：

```sh
node scripts/run.ts --headed --runs 3 --img 1 --fw react,solid
node scripts/run.ts --browsers wkwebview-60       # WebKit 默认的 60fps 限制，作对照
node scripts/hz.ts                                # Playwright 浏览器在无头/有界面时的 rAF 频率
node scripts/report.ts results/raw-….json         # 从原始数据重新生成报告
bun run serve                                     # 手动打开 http://127.0.0.1:4321/<变体>/
```

`--browsers chromium,webkit` 仍可用 Playwright 的浏览器跑（Chromium 另有 CDP 的 JS 堆和主线程数据），只作参考。

结果写到 `results/`：`raw-*.json` 是原始样本，`report*.md` 是汇总表。

## 原生外壳：mygo 与 Wails v3

`shells/` 下各有一个最小的 Go 程序，用 mygo 或 Wails v3 开一个窗口加载 Solid 变体（同一个页面，只比外壳）。页面带 `?auto=1` 时自己依次跑场景，每个场景开始和结束时请求一次 `/mark`；`scripts/shells.ts` 每 0.5 秒用 `ps` 统计外壳进程和它启动后新出现的 WebKit 进程的 CPU 时间与 RSS，每 3 秒取一次 `footprint`。两个外壳都没有关 WebKit 的 60fps 限制。

```sh
(cd shells/mygo && go build -o ../../.build/shell-mygo .)
(cd shells/wails && go build -o ../../.build/shell-wails .)
bun run build
caffeinate -dis node scripts/shells.ts --runs 2 --src real --n 1000
caffeinate -dis node scripts/shells.ts --runs 5 --scenarios load,churn,open,switch
```

跑的时候屏幕不能锁：锁屏后 rAF 几乎停止，场景会一直等到超时，所以用 `caffeinate -dis` 保持亮屏。CPU 按 0.5 秒采样，单个场景低于约 0.5 秒的数字没有意义。结果见 `results/report-shells.md`。

## 刷新率

WebKit 默认把页面渲染更新限制在 60fps 附近（`PreferPageRenderingUpdatesNear60FPSEnabled`），即使在 120Hz 的 ProMotion 屏上也是如此；无头的 Playwright 浏览器也都是 60Hz。用 wkdriver 实测系统 WKWebView：保持默认是 60fps，像 Picnest 那样关掉之后是 120fps。

## 内存怎么看

WKWebView 下以 `footprint`（活动监视器显示的那个数）为准，RSS 只作参考：解码后的图片大多以 GPU 纹理的形式存在，计入 footprint，但不计入 RSS。

- 滚动时，滚过的缩略图会以解码后的纹理暂留在 WebKit 里，滚得越快越多：稳速滚 36000px 时 footprint 约 800MB，快速甩完 5000 张时约 2GB。这是滚动中的峰值，不是泄漏：停下后约 2 秒就回落到约 140MB。峰值和缩略图的解码尺寸成正比。
- `--purge` 会在每个内存检查点之后让 WebKit 清空内存缓存（`WKWebsiteDataStore` 的 `WKWebsiteDataTypeMemoryCache`，app 也能这样调用），再记录一次。`node scripts/flicker.ts` 对比清空前后的截图：屏幕上的图片不会闪烁，但 WebKit 停下后自己 2 秒内就会释放，所以 app 没有必要手动清。

## 局限

- 用的是与 Picnest 相同的系统 WKWebView，但 mygo 的原生桥接、`convertFileSrc` 等没有覆盖；WKWebView 拿不到 JS 堆，内存只看渲染进程 RSS
- 预览切换没有做 framer-motion 的弹簧动画（三个框架的动画库不同，会掩盖框架本身的差异）
- 图片来自本地 HTTP，而 app 里是本地文件；两者解码成本相同，加载路径不同
- 只测最新稳定版；Solid 2.0 还是预发布版，没有测
