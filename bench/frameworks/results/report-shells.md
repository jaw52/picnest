# 原生外壳：mygo 与 Wails v3

- 时间：2026-10-17；机器：Apple M1 Pro, macOS 27.0.1；有界面，`caffeinate -dis` 保持亮屏
- 外壳：mygo v0.4.8，Wails v3.0.0-beta.26；都只开一个 1200×800 的窗口，都没有关 WebKit 的 60fps 限制
- 页面：Solid 变体，1000 张本机图库照片（`--src real --n 1000 --img 1`）
- CPU 与 RSS 为外壳进程加它启动后新出现的 WebKit 进程（WebContent、GPU、Networking）之和；CPU 每 0.5 秒采样一次

两者没有实质差别：同一个系统 WKWebView 做了几乎全部工作，外壳进程自身只占约 100MB、空闲时 CPU 不到 1%。

## 全部 14 个场景（每个外壳 2 轮）

| 指标 | mygo | Wails v3 |
|---|---:|---:|
| 打开页面 CPU | 0.43 s | 0.48 s |
| 全部场景 CPU | 25.1 s | 21.6 s |
| 其中 churn | 9.5 s | 5.8 s |
| 去掉 churn | 15.7 s | 15.8 s |
| 墙钟时间 | 18.8 s | 18.8 s |
| 空闲 CPU | 0.6–1.0% | 0.6–1.2% |
| 峰值 RSS | ≈ 2.0 GB | ≈ 2.1 GB |
| 峰值 footprint | ≈ 1.49 GB | ≈ 1.26 GB |
| 跑完回落后的 footprint | 167 MB | 175 MB |
| 外壳进程 RSS | ≈ 101 MB | ≈ 99 MB |

churn 排在最后、只跑了 2 轮，差距在下面的复测里没有重现。

## 复测 churn / open / switch（每个外壳 5 轮，中位数）

`--scenarios load,churn,open,switch`

| 指标 | mygo | Wails v3 |
|---|---:|---:|
| churn CPU | 9.4 s（8.6–10.5） | 11.1 s（8.7–11.7） |
| open CPU | 0.58 s | 0.54 s |
| switch CPU | 2.09 s | 2.07 s |
| 整轮 CPU | 12.1 s | 13.7 s |
| 墙钟时间 | 7.2 s | 7.4 s |
| 峰值 RSS | ≈ 1.7 GB | ≈ 1.65 GB |
| 峰值 footprint | 540–660 MB | 490–565 MB |
| 跑完回落后的 footprint | ≈ 200 MB | ≈ 190 MB |

两边范围大面积重叠，在波动之内。
