# Electron 0.2.0 验收矩阵

只将实际运行结果标为 PASS。环境：Debian 13，Electron 44.9.0 / Chromium 152，1920×1080、deviceScaleFactor 1；独立临时档案。未执行 CircleCI。

| 功能/场景 | 测试 | 结果 | 证据 |
|---|---|---|---|
| HTML 核心规则/数据模型 | Node 114 项 | PASS | HTML artifacts/electron-picker/unit.log |
| 26 道具使用/计分/归档/导入导出/音频等核心浏览器场景 | 原 Chromium 主套件 117 项 | PASS | HTML artifacts/electron-picker/core-browser.log |
| 原规则 oracle | 26 项 | PASS | 同上，pass:26 fail:0 |
| 配额失败、启动存储拒绝、异步防御、按人赋分及撤销 | 原 test:e2e 后续套件 | PASS | 同上对应 PASS 行 |
| 三模式、防重复、预选组、重复 start/stop、异步 cancel、旧结果、import/undo | 新 HTML picker 浏览器回归 | PASS | HTML tests/e2e/electron-picker.mjs / results.json |
| 14 组同配置 before/after | Chromium DOM 与截图对照 | PASS | HTML artifacts/electron-picker/layout；1920、1x、double、垫片120px |
| Electron IPC、重复消息、超时、reload、权限、几何、配置、SHA、Escape | Node 12 项 | PASS | artifacts/electron-020/unit.log |
| 主窗口、picker、overlay 三模式/动画/结果/赋分/窗口重开/刷新/恢复 | 真实 Electron 12 场景 | PASS | artifacts/electron-020/results.json |
| start/stop/roll_win 音效单次调度 | 三模式实际主 renderer 调用断言 | PASS | desktop/test-probe.cjs；非真实听感 |
| 应用 origin/五页/LS/IndexedDB 刷新保留 | test:smoke | PASS | artifacts/electron-020/smoke.log |
| 初始化失败不能报告空 PASS | 故障注入负向测试 | PASS | regressions/setup-after.json 为预期 FAIL；setup-before.json 为修复前错误 PASS |
| 演出窗口非抢焦点配置、按钮/IPC 跳过、自动销毁 | Electron 窗口与 DOM 断言 | PASS | results.json、effect-*.png |
| 多屏选择、显示器移除边界 | 纯函数模拟 | PASS | Node 几何测试 |
| 真实 PPT 覆盖、跨应用鼠标穿透/焦点/全局热键 | Windows 真实桌面 | NOT TESTED | 当前无 Windows 桌面 |
| 真实拖动、多屏/投影仪热插拔、混合 DPI | Windows 硬件 | NOT TESTED | 当前只有合成单屏 |
| Windows x64 自包含 ZIP | 构建、ZIP 和 ASAR 校验 | PASS | build-cross.log / release-integrity.json |
| Windows NSIS/portable | Linux Wine 构建尝试 | BLOCKED | installer.log，IA32 helper 无法执行 |
| Windows exe 启动与安装/卸载 | 提供 test:windows 原生脚本 | NOT TESTED | 当前宿主非 Windows；Wine 尝试不替代真机验收 |
| 原始 file:// | 受管理 Chromium 策略阻止 | BLOCKED | net::ERR_BLOCKED_BY_ADMINISTRATOR；Electron 离线 custom scheme 已运行 |
| 音乐听感/投影仪输出设备 | 人工听辨 | NOT TESTED | 需实际音频设备 |

Linux 无桌面服务的测试启动用了 --no-sandbox；生产未加入该参数。实际 Windows 进程沙箱、OS 置顶层级与硬件行为仍须原生验证。截图通过不能替代上述功能断言。
