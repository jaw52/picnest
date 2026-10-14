<div align="center">

# Picnest

**A fast photo browser for macOS.**
**一款为 macOS 打造的快速图片浏览器。**

Built with [mygo](https://github.com/egoist/mygo) · 基于 [mygo](https://github.com/egoist/mygo) 构建

[English](#english) · [简体中文](#简体中文)

![Picnest screenshot](docs/screenshot.png)

</div>

---

## English

Picnest lets you browse, rate and sort through folders of photos. Open any folder on your Mac and your pictures are right there, with nothing to import.

### Install

Download the `.dmg` from [Releases](https://github.com/jaw52/picnest/releases) and drag Picnest into Applications.

The app is not notarized yet, so macOS may say it is damaged or from an unidentified developer. Run this once:

```sh
xattr -cr /Applications/Picnest.app
```

### Requirements

- macOS on Apple silicon (arm64)

### Build from source

Requires [Bun](https://bun.sh) and [Go](https://go.dev). The [mygo](https://github.com/egoist/mygo) CLI is pinned as a Go tool in `apps/desktop/go.mod`, so there is nothing else to install.

```sh
bun install
bun run dev     # run in development mode
bun run build   # build Picnest.app and a .dmg into apps/desktop/bin
```

---

## 简体中文

Picnest 用来浏览、评分和筛选文件夹里的照片。打开 Mac 上的任意文件夹即可查看，无需导入。

### 安装

从 [Releases](https://github.com/jaw52/picnest/releases) 下载 `.dmg`，把 Picnest 拖进“应用程序”。

应用暂未公证，macOS 可能提示“已损坏”或“无法验证开发者”。执行一次：

```sh
xattr -cr /Applications/Picnest.app
```

### 系统要求

- 搭载 Apple 芯片（arm64）的 macOS

### 从源码构建

需要安装 [Bun](https://bun.sh) 与 [Go](https://go.dev)。[mygo](https://github.com/egoist/mygo) CLI 已作为 Go tool 固定在 `apps/desktop/go.mod` 中，无需额外安装。

```sh
bun install
bun run dev     # 开发模式运行
bun run build   # 构建 Picnest.app 和 .dmg，输出到 apps/desktop/bin
```
