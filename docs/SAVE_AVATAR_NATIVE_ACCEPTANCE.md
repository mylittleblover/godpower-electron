# 存档与头像原生联调检查点

版本3.0.69；分支feat/save-document-avatars。HTML源42acb2f（完整SHA与资源摘要见resources/BUILD_INFO.json）。当前仅为本轮数据基础设施检查点，其余ZIP功能继续推进。

- npm test：75项全部PASS。测试需设置GODPOWER_HTML_REPO=/workspace/godpower-html-latest；第一次未指定环境变量导致源码相对路径ENOENT，不能当产品通过，修正执行路径后重跑。
- verify:bundle：PASS，单文件与schema字节匹配。
- DISPLAY=:99 DESKTOP_ARTIFACTS=artifacts/save-library-active-fixed npm run test:desktop：21场景全部PASS。
- 上一联调在第9项减速状态超时，保留artifacts/save-library-active与diagnostic失败记录；修复HTML动画生命周期和赋分ACK后重新同步，未删除或放宽该断言。
- 已覆盖磁盘FIFO、原文读取、新SaveVault IPC/CAS、跨档过期请求、14组布局、内部窗口输入/设置、全屏音效配置、安全preload、主题、主窗口关闭后台、三种点名、全屏揭晓、赋分、悬浮窗生命周期与显示器数据。

环境Linux Xvfb+xfwm4、Chromium/Electron 1920×1080 DPR1。Windows真机与触屏、屏幕键盘、PPT覆盖、多物理屏幕、听觉验收NOT TESTED。没有执行CircleCI。

不包含真实学生姓名、照片、课堂原始存档；迁移包保留私有工作区，待完成发行验证后通过用户Drive版本目录提供。
