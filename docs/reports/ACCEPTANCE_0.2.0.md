# Electron 0.2.0 实施与验收报告

日期：2026-10-18。实现起点：Electron main `22f51f0`，HTML main `29966b4`，fetch 确认无更新。独立工作分支为 Electron `feat/electron-0.2.0`、HTML `feat/electron-picker-bridge`。主要实现提交 Electron `348d23d4fdfd1ef797bc06cde0f3539d77d0a5fc`；同步 HTML 源码提交 `2f1251ef9f93cbf1aa69902d74a4a63e0f8cb417`。

## 实施结果

本次实现三个安全窗口，包含完整悬浮点名和全屏动画，没有将特效推迟到后续版本。主窗口继续负责全部课堂业务、随机选择和存储；辅助窗只发命令或展示 DTO。点名浮窗支持三模式、原防重复/预选奖池、减速揭晓、结果记录、六槽位及手输赋分、置顶、拖动区、缩放、记忆位置、关闭重开、全局 Ctrl+Shift+P 和指定显示器。

透明无边框演出窗在结果确认后创建，具有聚焦入场、光环粒子、姓名/小组/学号揭晓和淡出；单实例、鼠标穿透策略、非抢焦点配置、Escape/按钮/浮窗跳过及 watchdog 均实现。音效由原主窗口音频系统播放，远程开始/停止/赋分按钮使用原自定义声音槽，不重复播放揭晓音效。实际跨 Windows 应用覆盖与听感尚待原生验收。

保持原 appId、userData、classroom://app origin、localStorage/IndexedDB、课堂 Schema、26 道具和原计分历史规则。新增的 desktop-windows-v1.json 只存壳层窗口配置。HTML 仍能生成自包含单文件，27 原内置资源均保留。源代码修改在 HTML 仓库完成构建后同步，没有编辑发布 HTML 形成分叉。

## 实际测试

- HTML Node：114/114 PASS。
- 原 Chromium 主套件：117 PASS / 0 FAIL，包括全部26种道具、计分、归档、导入导出、资源与音频初始化/解码；规则 oracle 26/26 PASS。
- 原 test:e2e 的配额、存储拒绝、异步防御和按人赋分/撤销套件均成功结束。最新完整日志在 HTML artifacts/electron-picker/core-browser.log。
- 新 HTML picker 回归：三模式、隐藏预选结果、防重复循环、双层预选、重复 start/stop、异步取消、过期/替换目标拒绝、import/undo 清理，实际执行 PASS。
- Electron Node：12/12 PASS（权限、消息参数、重复/冲突请求、超时与迟到确认、主 epoch、窗口几何/配置、SHA 校验、Escape 所有权）。
- 真实 Electron：12/12 场景 PASS。包括三模式主/浮/特效结果一致、每次 start/stop/win 各一次声音调度、一次赋分、自动退场、关闭重开、浮窗刷新序号、重复 effect ready、演出中断、主 reload、IndexedDB 资源、主 renderer 崩溃恢复。渲染器/preload errors 数组为空。
- Smoke：五页面、固定 origin、localStorage 与 IndexedDB 刷新恢复均 PASS。
- 故障注入：人为初始化异常现在输出 FAIL 并让运行器退出失败，不再允许空 results 误报 PASS。修复前后报告保留。

环境：Debian 13，Electron 44.9.0 / Chromium 152.0.7977.167，合成1920×1080屏幕、1x。独立临时 userData，不读取或清理真实课堂数据。Linux 测试启动使用 --no-sandbox；产品窗口的 sandbox/contextIsolation/webSecurity 配置为 true，生产启动不附加 --no-sandbox。测试宿主出现 D-Bus 缺失及 headless GPU mailbox 日志，这些属于宿主环境日志，完整保存，不当作 Windows 图形验收证据。

## 14 小组布局和截图

HTML baseline 和 after 使用相同1920×1080、1x、double模式、120px垫片及同一14组数据，位置/尺寸最大差值 **0px**。四列均为463px；最后一排底部670.375px，底栏顶部1013px；before/after 页面 scrollHeight 均1126px，没有新增滚动需求。配置来自可重复 fixture，用户真实课堂配置尚未读取，不能声称复现了用户设备设置。

HTML 仓库：artifacts/electron-picker/layout/before、after、battle-14-comparison.json。Electron：artifacts/electron-020/battle14.png、battle14-dom.json；picker-ready、picker-{individual,group,two_tier}-{rolling,result}.png；effect-{individual,group,two_tier}.png。已实际查看浮窗和演出截图，修正深色组色在暗色演出标签上的对比度。没有改比赛页的尺寸、间距、列数或垫片。

动画用 CSS transform/opacity 与原主窗口减速流程，已验证阶段和销毁行为；未记录实际 Windows FPS、GPU性能或真实音量，不能以截图替代这些指标。

## 审查发现及处理

独立 reviewer 检查了两个仓库的代码和边界，未发现存储隔离、唯一计分或旧导入目标方面的新增 Critical 问题。已修复：

1. 旧 stop 包装器重复记历史：合并到原停止函数，重复 stop 不再追加。
2. 快速 close/open 对正在关闭实例 show：等待 closed 后重建，保留回归失败与最终成功证据。
3. 悬浮窗 reload 重置 seq，但 Broker 旧 high watermark 未清理：每次辅助窗加载分配 transport UUID，旧请求失效，新序号可用。
4. 重复 effect-ready 可能覆盖 Escape 注册所有权：独立 EscapeLease 只注册一次并准确释放；模拟第二次注册返回 false 的 Node 回归已通过。
5. setup 异常曾可能报告空 PASS：异常进入报告，运行器还强制12场景全部执行。

没有为了通过测试修改计分、道具、抽选概率或降低业务断言。规则明确时保留旧行为：双层抽选仍使用原候选学生池，不自行改成均匀小组概率。

## Windows 交付和环境限制

Windows x64 ZIP 构建 PASS；ZIP CRC 完整性、PE32+ x64 exe、ASAR 资源与最终源码逐字节校验 PASS。辅助页面、preload、安全模块和原HTML均在包内；测试 probe 排除出发行物。完全解压后运行「上帝的力量.exe」，无需 Node、浏览器、本地服务器或网络。

文件：release/上帝的力量-0.2.0-win.zip；147076250 字节。

SHA-256：`119f7e3e0ef682f14ef9fa26166b54e52214a4060ee75d159c686314fd9ae13f`。

内含 HTML SHA-256：`8e2f6d7471e7030d87e8e6045629eba642690cfa43957408c6e1fdd40ebf76d6`，7786515字节。

已尝试 npm run build:win，当前 Wine 无法运行32位 rcedit helper，NSIS/portable 未生成，状态 **BLOCKED**。为保留可用的完整发行格式，使用 build:win:cross 生成 x64 ZIP；不假称已生成安装器。ZIP 构建使用 signAndEditExecutable=false，跳过本环境不能运行的资源编辑及签名步骤；程序包版本为0.2.0，但 exe 的 Windows 文件属性/图标可能保留 Electron 默认值，需原生 Windows 构建完成最终元数据。

也实际尝试 Wine 启动本版 Windows exe：退出码3，出现无显示驱动、HWND 和 XDG_RUNTIME_DIR 环境错误。此尝试状态 BLOCKED，不能证明 Windows GUI 能运行。此前 Wine cmd/ver 成功仅验证命令行环境。Windows 真机启动、安装/卸载、PPT 覆盖、全局热键行为、鼠标穿透、真实拖动、多显示器热插拔与混合 DPI 均 **NOT TESTED**。

已提供可执行的 scripts/windows-smoke.mjs 与 README PowerShell 命令；当前非 Windows 运行明确输出 NOT TESTED 和退出码2。Windows 验收时还应人工验证：主窗口最小化 → 打开 PPT → Ctrl+Shift+P → 三模式停止揭晓 → 指定投影屏 → Escape/跳过 → 焦点与音频恢复 → 拔屏 → 重开窗口 → 重启读取旧数据。原生多显示器与权限层级不能由本次 Linux headless 测试代替。

无远端 CI/CircleCI 执行、无收费操作、无签名证书采购。完整状态矩阵见 TEST_MATRIX.md，下一阶段优先执行 MAINTENANCE_BACKLOG.md 的 EL020-01/02/03。
