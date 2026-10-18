# 悬浮图标、独立窗口和后台运行验收

2026-10-18。基线 Electron `cb7b76c`，HTML `2f1251e`；发行包源码映射见 `resources/BUILD_INFO.json`。功能在独立分支实施，未合并 main。

## 完成内容

- 启动默认点名小图标：点击展开、收起返回、拖动、图标位置与面板尺寸分别保存，关闭再开恢复；三种模式、原抽选池和原赋分规则不变。
- 12 类现存功能窗口为独立 BrowserWindow；输入、按钮、确认、关闭、密码、刷新和快速编辑仍由主课堂原处理器执行；无第二份课堂状态或随机抽选算法。
- 新增全屏点名、全屏加分、全屏扣分音效槽位及设置分类，沿用原多候选随机播放/音频存储。加减分使用独立透明覆盖窗。
- 关闭主窗口隐藏并继续运行，点名可用；托盘提供恢复和彻底退出。退出屏障拒绝晚到快照，并销毁展示窗口，防止退出过程中重新创建窗口。
- 独立窗口具有入场/退场动画和系统减少动态效果支持；结算彩纸在展示窗独立绘制，不参与规则计算。

## 已修复的回归问题

旧点名包装器丢失内部参数；快速输入因快照版本变化被丢弃；密码确认后本地输入被清空；重开/刷新后的输入序号被旧确认值拒绝；连续音频上传的前一任务清理了后一任务；隐藏窗口占用主页面焦点栈；按人赋分窗口继承页面边距造成顶部裁切；退出时晚到快照重新创建窗口。

## 实际执行证据

Electron/Chromium 使用 Linux 真实 BrowserWindow、隔离用户目录、1920×1080、1x，Electron 44.9.0 / Chromium 152.0.7977.167。辅助窗口在该桌面内按其实际窗口尺寸检查，不把辅助窗强制放大至全屏。测试容器使用 --no-sandbox 启动，已检查生产 WebPreferences 保持 sandbox/contextIsolation/webSecurity=true、nodeIntegration=false；不将容器运行结果冒充 Windows OS 沙箱验证。

Node 测试 14 PASS，HTML 单元/集成测试 114 PASS。Chromium 实际上传三个槽位的 WAV 候选、单次随机播放、设置显示与真实刷新恢复 PASS；HTML 三模式抽选、取消、过期结果回归 PASS。Electron 15 场景全部 PASS，最终进程正常退出（非仅 JSON 显示通过）。原生赋分在快速输入后立即确认，只加一次；逐字口令、独立窗重开/刷新及取消不计分均执行。

| 场景 | 结果 |
|---|---|
| 1920×1080 1x, 14 group fit and unchanged main layout | PASS |
| native functional windows forward inputs and preserve single score owner | PASS |
| fullscreen sound slots are configurable and score reveal is a native overlay | PASS |
| secure preload and isolated origin in independent picker | PASS |
| closing main keeps authoritative renderer alive and can restore it | PASS |
| individual authoritative draw, continuous reel, overlay and score | PASS |
| group authoritative draw, continuous reel, overlay and score | PASS |
| two_tier authoritative draw, continuous reel, overlay and score | PASS |
| close/reopen while spinning keeps one engine and retained window bounds | PASS |
| picker reload accepts fresh commands without sequence conflicts | PASS |
| duplicate effect ready always releases Escape registration | PASS |
| effect interrupts and stale finish cannot close a newer result | PASS |
| reload cancels transient picker, preserves classroom storage and rejects stale outcome | PASS |
| custom audio/resource store remains accessible to main only | PASS |
| main renderer crash blocks commands until explicit recovery without reroll | PASS |

14 组 DOM 对比：1920×1080/1x，同一测试布局与基线比较，各卡 x/y/宽/高/底部最大差值 0，全部处于底栏上方。参见 `artifacts/detached-windows/battle14-comparison.json`。此为已记录测试配置，不声称复制了用户设备的私人配置。

截图、每类窗口 DOM 边界、控制台与命令输出：`artifacts/detached-windows/`。窗口截图等待真实入场结束后捕获，未以截图生成成功代替功能测试。Node 窗口位置测试与真实 BrowserWindow 拖动路径使用注入光标坐标，实际 Windows 鼠标拖动仍未验收。

Windows ZIP 交叉构建、ASAR 源码逐字节比对、HTML SHA-256 和内置托盘图标完整性结果见 `artifacts/detached-windows/release-integrity.json`。解压运行 `上帝的力量.exe`，不要只拷贝 exe。

## 尚未执行

Windows 原生程序启动、系统托盘图形交互、真实鼠标/投影双屏、跨 PowerPoint 覆盖、系统文件选择器与人工音效听感：NOT TESTED。NSIS/签名资源编辑沿用环境限制；本次交付自包含 Windows ZIP，不声称安装器验证通过。Firefox、WebKit、其他分辨率和 CircleCI 均未执行，遵循用户约束。

全窗口 DOM 展示快照仍是渐进适配层；后续增量渲染、大文件原生对话框与人工听感任务见 MAINTENANCE_BACKLOG.md。未修改存档键、计分、排名、道具参数或撤销语义。
