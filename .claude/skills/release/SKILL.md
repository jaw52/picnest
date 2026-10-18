---
name: release
description: 发布 Picnest 的新版本：改版本号、写 CHANGELOG、打 tag、构建并上传签名的更新包到 GitHub Release，再补全说明后发布。用户说"发版""发新版本""release 0.x.y"时使用。
---

# 发布新版本

已安装的 app 会读取 `jaw52/picnest` **最新一个已发布 release** 里的 `update-darwin-arm64.json` 来自动更新，所以 release 一旦发布，用户就会收到更新。发布前务必确认版本可用。

## 0. 确认版本号和改动

- 问用户要发哪个版本，或者按改动推荐一个（`feat` → 次版本号，只有 `fix`/`perf` → 修订号）。
- 列出上个 tag 以来的提交：`git log --oneline v<上个版本>..master`
- 要在 `master` 上发版。工作区必须干净，并且已和 `origin/master` 同步。

## 1. 检查

```bash
bun run typecheck && bun run test && bun run lint
```

有失败就停下来，告诉用户。

## 2. 改版本号

下面两处要改成同一个版本号，然后运行 `bun install` 更新 `bun.lock`：

- `apps/desktop/mygo.json` 的 `version`
- `apps/desktop/frontend/package.json` 的 `version`

## 3. 写 CHANGELOG

在 `apps/desktop/CHANGELOG.md` 的 `# Changelog` 下面、旧版本之前，加一个 `## <版本>` 段落。没有这一段，构建会直接失败。这段内容就是更新窗口里显示的说明，也是 release 的正文。

格式照旧版本：英文在前，下一行缩进两格写中文。只写用户能感受到的变化，不写重构、chore、测试。

```markdown
## 0.5.0

### What's new / 新功能

- **Short title** — one or two sentences on what the user can now do.
  **中文标题**：对应的中文说明。

### Fixes / 修复

- What no longer goes wrong.
  修复……的问题。
```

先把草稿给用户看，用户确认后再继续。

## 4. 提交、打 tag、推送

```bash
git add apps/desktop/mygo.json apps/desktop/frontend/package.json bun.lock apps/desktop/CHANGELOG.md
git commit -m "chore: release <版本>"
git tag v<版本>
git push origin master v<版本>
```

推送前先征得用户同意。

## 5. 构建并上传

```bash
cd apps/desktop && CGO_ENABLED=0 go tool mygo build -upload
```

- 签名私钥由 `mygo.json` 的 `updates.privateKey` 指定，位置是 `~/Library/Application Support/mygo/update-keys/mygo-update.key`。私钥只放在这台机器和用户的密码管理器里，**绝不能**提交进仓库，也不能打印出来。私钥不在时，构建只会生成安装包、不生成更新文件，这时停下来告诉用户。
- 上传需要已登录的 `gh`（`gh auth status`）。它会建一个**草稿** release，标题是 tag，正文是 CHANGELOG 里的那段，并上传 `.dmg`、`.tar.gz`、`.delta` 和 `update-darwin-arm64.json`。
- 只要之前有版本发布过，它就会生成增量包。输出里如果写着 "No delta updates"，就看看原因。第一次发布时出现这句是正常的。

## 6. 补全 release 说明

草稿的标题和正文要改成以前的样式：标题写 `Picnest <版本>`，正文是 CHANGELOG 那段再加上下面这段固定结尾。把正文写进 scratchpad 里的临时文件，然后运行：

```bash
gh release edit v<版本> --repo jaw52/picnest --title "Picnest <版本>" --notes-file <正文文件>
```

固定结尾：

````markdown
**Requires / 系统要求:** macOS on Apple silicon (arm64)

**Install / 安装:** open the .dmg and drag Picnest into Applications. The app is not notarized yet; if macOS says it is damaged, run once:
打开 .dmg，把 Picnest 拖进“应用程序”。应用暂未公证，若提示“已损坏”，执行一次：

```sh
xattr -cr /Applications/Picnest.app
```
````

## 7. 发布

请用户在 GitHub 上看一遍草稿。用户确认后再发布：

```bash
gh release edit v<版本> --repo jaw52/picnest --draft=false
```

发布后，已安装的 app 会在一天内的后台检查中，或者用户点「检查更新…」时，收到这个版本。

## 注意

- app 是 ad-hoc 签名，没有苹果公证。这不影响自动更新：更新包用 mygo 自己的 ed25519 密钥签名和校验。
- 0.4.0 及更早的版本里没有更新器，这些用户需要手动下载一次新版本。
