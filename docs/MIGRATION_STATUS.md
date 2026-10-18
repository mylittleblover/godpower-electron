# Electron 迁移状态

## 基线

- 源仓库：`mylittleblover/godpower-html`
- HTML 基线提交：`29966b41d4d5d9330bab67d787c71e47ce97dbee`
- HTML 版本：2.19.0
- 发行形态：约 7.5 MiB 的内嵌资源单文件 HTML
- Electron 仓库从空仓库开始；引用对话目前只提供“检查最新提交，准备开始迁移到 Electron”，其余决策未能读取。

## 本阶段实现

第一阶段以包装现有 HTML 为 Electron renderer，避免重写课堂业务。主进程只托管一个受限的 `classroom://app/index.html` 页面，稳定来源用于 Electron 自己的本地 localStorage / IndexedDB。没有引入网络运行依赖，也没有触碰 HTML 仓库中的用户数据。

### 主进程与安全边界

- `main.cjs`：单实例、桌面窗口、菜单、受限应用协议、生命周期。
- renderer：`nodeIntegration=false`、`contextIsolation=true`、`sandbox=true`、`webSecurity=true`。
- CSP 限制默认资源及网络连接；不允许对象、iframe、非应用导航或新窗口；拒绝权限请求和 webview。
- 没有 preload/IPC 桥，HTML 无法直接访问 Node.js。
- `resources/index.html` 是同步进来的 HTML 发行物；`BUILD_INFO.json` 追踪其源码版本与哈希。
- Windows x64 包装配置使用 Electron 44.9.0，包含品牌图标、中文界面、NSIS 安装器与便携启动器目标。安装时允许选择目录，卸载不会删除用户数据。

## 本地构建验收

- 已用 Linux 跨平台构建生成并校验 `release/上帝的力量-0.1.0-win.zip`（141 MiB，SHA-256 `1c7ea36cbe6f29485df105a67800008eda76bd778d47ddc94619bd037f29eeff`；包含 `上帝的力量.exe`、`resources/app.asar` 和 Windows 运行库）；压缩包校验无损，EXE 识别为 Windows x64 PE GUI 程序。此 ZIP 解压后运行程序，不是安装包。
- 使用隔离临时用户目录启动 Electron smoke：五个页面入口存在，`classroom://app` 下 localStorage 和 IndexedDB 可用，刷新后数据仍存在。结果 PASS；未接触生产存档。
- Linux 上无法生成最终 NSIS/单文件便携封装：electron-builder 要求 Wine 修改 Windows 可执行文件资源。仓库保留 Windows 原生完整打包命令 `npm run build:win`；Linux 可复现打包目录及 ZIP 用 `npm run build:win:cross`。
- 未在真实 Windows 主机上运行安装程序或验证签名/SmartScreen；目前没有代码签名证书配置。需 Windows 主机验收安装、卸载保留数据、菜单、音频和文件选择。

## 数据兼容边界

Electron 的 origin 是 `classroom://app`，与 ChatGPT Sites、普通 HTTPS 页面和 iOS 浏览器 origin 不同；浏览器 localStorage / IndexedDB 不会自动出现在 Electron。第一次迁移应在独立测试环境先导出现有 JSON/归档和音频包，再逐项导入 Electron 并校验。不要让程序尝试读取另一个浏览器 profile，也不要对原始数据执行清空。

现有 HTML 可能对 `file://` 使用有浏览器差异；本壳以 Electron 注册的安全标准协议托管文档。需验证存储恢复、IndexedDB 音频、文件导入、下载、打印和键盘操作。

## 尚待迁移

1. 确认对话中的目标 OS、最低系统版本、签名和安装/更新策略。
2. 在隔离 profile 验证 Electron 内首次启动、刷新、退出重开后的 localStorage 与 IndexedDB 持久性。
3. 验证音效上传、音乐包导入导出、备份下载、课堂名单和大容量档案。
4. 明确旧浏览器数据迁移交互和失败回滚步骤；目前不自动迁移。
5. 真实 Windows 桌面回归，确认 `classroom://` CSP 没有阻止文件、音频和旧 UI 所需功能；当前临时 Linux Electron smoke 已通过页面装载与存储刷新检查。
6. 建立 Windows 安装包与签名发布流程；确认签名证书后再配置。
7. 评估崩溃报告、备份位置、卸载时是否保留课堂数据。

## 不在本阶段范围

没有改变计分、排名、All In、26 种道具、历史撤销、归档结构或音频业务逻辑。没有触碰 HTML 仓库工作区；没有连接 CircleCI 或其他 CI。没有发布安装包。
