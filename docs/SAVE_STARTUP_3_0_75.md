# 3.0.75 新版存档直接打开

同步 HTML 7c6b2c5（含 669f824），来源及 SHA-256 在 resources/BUILD_INFO.json。

新版库优先读取，跳过旧镜像及固定文件转换。删除设置初始化及离开页面重复保存；空闲炮弹定时器不保存或重绘，活动效果仍按原规则执行。首次空库旧接入及真实退出保存保留。

验证：Electron 单元/集成 94/94，HTML 451/451；构建来源及版本验证通过。Linux Electron 44.9.0、Chromium 152、1920×1080 1x 两次重载，损坏旧镜像不影响新版读取，文档及索引不变，旧固定文件读/写均 0，无 renderer/preload 错误。证据 artifacts/save-startup/results.json、canonical-reopened.png。专项命令 DESKTOP_SCENARIO=startup npm run test:desktop，使用隔离 profile。

Windows 真机 NOT TESTED，真实云端 API NOT TESTED。没有操作真实课堂数据。

截图：https://drive.google.com/drive/folders/1lxQ7pxYLg-7L3LBdWEiJKsQcDeJng6_p
