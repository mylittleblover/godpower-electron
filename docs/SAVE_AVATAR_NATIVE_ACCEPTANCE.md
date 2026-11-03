# 存档与头像原生联调检查点

版本3.0.69；分支feat/save-document-avatars。HTML源42acb2f（完整SHA与资源摘要见resources/BUILD_INFO.json）。当前仅为本轮数据基础设施检查点，其余ZIP功能继续推进。

- npm test：75项全部PASS。测试需设置GODPOWER_HTML_REPO=/workspace/godpower-html-latest；第一次未指定环境变量导致源码相对路径ENOENT，不能当产品通过，修正执行路径后重跑。
- verify:bundle：PASS，单文件与schema字节匹配。
- DISPLAY=:99 DESKTOP_ARTIFACTS=artifacts/save-library-active-fixed npm run test:desktop：21场景全部PASS。
- 上一联调在第9项减速状态超时，保留artifacts/save-library-active与diagnostic失败记录；修复HTML动画生命周期和赋分ACK后重新同步，未删除或放宽该断言。
- 已覆盖磁盘FIFO、原文读取、新SaveVault IPC/CAS、跨档过期请求、14组布局、内部窗口输入/设置、全屏音效配置、安全preload、主题、主窗口关闭后台、三种点名、全屏揭晓、赋分、悬浮窗生命周期与显示器数据。

环境Linux Xvfb+xfwm4、Chromium/Electron 1920×1080 DPR1。Windows真机与触屏、屏幕键盘、PPT覆盖、多物理屏幕、听觉验收NOT TESTED。没有执行CircleCI。

不包含真实学生姓名、照片、课堂原始存档；迁移包保留私有工作区，待完成发行验证后通过用户Drive版本目录提供。

## 最终3.0.69阶段构建

- 源码21aa612cd84c02b469574e0d7387047492f46923，HTML SHA-256 d7fba24f38568f2e198551949a93b74dc627e0a085ecafa4768488119c72ca90；构建内共享schema及tooltip也逐项校验。
- 76/76单元PASS；artifacts/save-library-release/results.json，21/21桌面场景PASS，新增真实IPC移入回收站、禁止加载、恢复与原修订验证。
- 首次最终测试的X server已不在，启动失败日志保留desktop-display-unavailable.log；以与测试绑定生命周期的Xvfb+xfwm4重启后原断言全部通过。
- build:win:cross PASS，生成release/上帝的力量-3.0.69-win.zip；内含Windows x64 PE可执行程序，无需另装Node。
- ZIP149547274字节，SHA-256 2a9ff3618c621cef73ecdc077949883ac7ca0b11a24887f07005de708bf0c71f；21个ZIP条目CRC全部通过。
- verify-release逐字节验证包内主进程、preload、renderer、单文件HTML、共享schema/表现资源、版本；测试探针未打包。
- Windows原生测试脚本在Linux明确记录NOT TESTED；没有把交叉构建或Linux启动当作Windows启动。
- 专用Drive3.0.69版本目录提供程序与HTML；修复存档与可导入头像单开私有文件夹，真实学生数据不进Git。

本阶段其余功能状态沿用HTML执行台账；没有完成原ZIP全部M3–M7功能。
