# 上帝的力量 · Electron 桌面版

Electron 桌面外壳复用 HTML 版的离线单文件发行物，比赛、道具、档案和计分规则仍由 HTML 版实现。桌面端通过稳定的 `classroom://app` 安全来源运行，使用 Electron 独立用户配置目录保存本机数据。

## 开发

```sh
npm install
npm start
```

默认直接使用仓库内的 `resources/index.html`。同步最新 HTML 版发行物：

```sh
npm run sync:html
```

默认源文件为相邻目录 `../godpower-structure/dist/godpower.html`，也可通过 `GODPOWER_HTML_SOURCE` 指定构建产物。同步脚本会记录源提交、HTML SHA-256 和文件大小。

## Windows 安装包

```sh
npm run build:win
```

默认生成可自选安装目录的 NSIS 安装程序和便携版 `.exe`，输出位于 `release/`。在 Windows 上使用默认命令会写入应用图标和可执行文件版本信息。Linux 跨构建可运行 `npm run build:win:cross`；它输出解压即用目录及 ZIP，ZIP 内含可执行程序和所有运行文件，但不制作安装器或单文件便携启动器，也不写入 Windows EXE 图标/版本资源。完整的安装程序需在原生 Windows 环境运行 `npm run build:win`。构建需要下载 Electron Windows 运行时；安装后的应用运行不依赖 CDN、服务器或外网。

在 Windows 桌面环境运行 `npm run test:smoke`，用临时用户数据目录验证五个页面、IndexedDB 和刷新后的本地存储持久性。

## 安全与数据

- 渲染器关闭 Node.js 集成，启用上下文隔离、沙箱和 Web 安全。
- 主进程只提供内置 HTML；CSP 默认阻断网络连接，拒绝弹窗、跨源导航、嵌入式 webview 和浏览器权限请求。
- 不向渲染器暴露 IPC 或 Node API。
- `localStorage` 和 IndexedDB 保存在 Electron 的应用配置目录，按 `classroom://app` 来源隔离。浏览器站点、iOS WebView 和 Electron 数据互不自动复制。
- 请先在隔离测试环境手动导入备份，确认名单、分数、档案和音频，再迁移课堂使用。当前版本不自动扫描或清理其他浏览器数据。

## 当前阶段

这是第一阶段 Electron 安全外壳，不包含原生通知、系统级自动更新、硬件集成或自动浏览器存档迁移。查看 `docs/MIGRATION_STATUS.md` 中的边界、验证项和后续迁移任务。
