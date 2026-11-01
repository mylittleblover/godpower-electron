# 迁移状态：Electron 0.2.0

> 这里保留早期迁移记录。V3.0.62本地治理候选见 [同步预检与验收](validation/v3.0.62-sync-preflight.md)，本轮未重跑原生窗口/安装器验收。

主窗口、多窗口 IPC、置顶点名、透明全屏演出、指定显示器、跳过和异常恢复均已实现。HTML 仍为唯一课堂业务所有者，独立发行文件继续保留。

0.2.0 的真实 Electron/Chromium 验证见 reports/ACCEPTANCE_0.2.0.md 和 TEST_MATRIX.md。Windows x64 ZIP 自包含构建可用；NSIS/portable 受当前 Linux Wine IA32 helper 环境限制，Windows 真机启动、PPT 和投影仪验收仍 NOT TESTED。不能将 Linux API 调用成功视为 Windows 平台验收通过。
