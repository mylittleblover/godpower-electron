# 新存档仓库：实施记录

2026-11-03，独立分支feat/save-document-avatars，当前仍为开发版3.0.68，未发行新版本。

- SaveVault负责受控Documents/GodPower/save-library-v2目录，renderer不能指定路径。
- 复用已提交HTML源码中的SaveSchema；同步保存来源提交和SHA-256，启动校验共享文件，不复制一份规则分叉。
- 新文档按内容哈希不可变保存，资产/来源原文先暂存，最后原子发布index.json。发布失败保留旧索引；未发布的暂存资源不开放读取。
- 版本CAS、活动档代次、串行队列以及来源摘要回执分别防止旧写入、跨档写入、顺序颠倒和重复导入。
- 只向main角色提供saveVault白名单方法；通过既有发送者与main frame鉴权，不暴露文件系统/Node/任意IPC。
- 退出同时等待新旧存储队列。旧保存入口尚未切换，新仓库仅由明确调用使用，不冒充主程序完整迁移。

实际验证：67项单元/集成PASS；真实Electron的21项桌面场景PASS（Linux Xvfb/xfwm4，1920×1080、1x），包括新存档IPC、既有点名/特效及14组布局；bundle来源与哈希验证PASS。证据在artifacts/save-library-native。

尚待接入：当前档案管理界面、主课堂ACK切换、原始文件启动迁移、个人头像编辑与旧名单迁移。Windows物理设备、触屏、PPT、多屏未测试（NOT TESTED），没有操作CircleCI。
