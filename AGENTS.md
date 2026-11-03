# Repository instructions

修改前必须阅读根目录[DEVELOPMENT.md](DEVELOPMENT.md)，遵守当前用户授权及约束。

- HTML业务源码位于godpower-html，不直接改resources/index.html。同步必须校验已提交源码、可重复构建和SHA-256。
- 保持contextIsolation、sandbox、webSecurity及受控preload/IPC；禁止扩大Node或IPC权限。
- 普通弹窗留在主页面，原生点名/全屏窗共用主窗口唯一业务状态与结果。
- 不重置真实用户数据，不擅改28道具/计分/归档规则或14组布局。
- 默认验证Chromium1920×1080、1x；不操作CircleCI。Windows未实测必须如实标记。
- 保护无关修改，按逻辑提交；未经要求不合并main、不强推。
