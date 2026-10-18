# Electron 3.0.0 版本说明

本发行版本将 Electron 桌面壳版本号提升至 3.0.0。随包 HTML 继续使用其独立仓库和版本，不改动课堂业务版本或数据格式。

## 本次增量

- 所有独立功能窗口移除操作系统标题栏（`frame: false`），使用弹窗现有标题区域拖动；沿用原有关闭按钮，不重复添加标题栏。
- 独立窗口仍支持调整大小，课堂状态和业务操作继续由主窗口负责。
- 包含此前点名浮窗行为与实时赋分修复。

## 验证

- `npm test`：15 项通过。
- `npm run test:desktop`：15 项 Chromium/Electron 桌面场景通过；1920×1080、1x，其中包含 14 组布局验收。
- `npm run verify:bundle`：离线 HTML 包 SHA-256 校验通过。
- Windows x64 ZIP：由 Linux 环境交叉构建，压缩完整性检查通过。
- Windows 真机启动、Windows 原生边框拖动手感及多显示器测试：NOT TESTED。

## 发行文件

`release/上帝的力量-3.0.0-win.zip`
