# AI 多对话 3.0.76 验收

HTML来源6cc7314，完整提交和SHA-256由resources/BUILD_INFO.json记录。版本包/可见/内部均3.0.76。

新增独立会话列表、搜索、重命名、删除/清空确认、本机自动保存/恢复；逐次授权最近成功模型上下文。数据与课堂存档分离，密钥不入聊天。恢复仅文字，不恢复可执行提案。服务连接仍共用一个配置，每会话独立提供商配置和网页检索尚未实现。

实际验证：

|项目|结果|证据|
|---|---|---|
|HTML完整单元/集成|PASS|456项|
|Electron完整单元/集成|PASS|95项，含history角色/字段/数量/长度校验|
|Chromium多会话专项|PASS|1920×1080 1x，会话隔离/重载/搜索/迟到响应/历史授权/CAS冲突/损坏库/容量/存储等待切页/旧任务不取消新任务|
|原AI改分与拒绝/修订/XSS|PASS|HTML专项，14组布局前后测量不变|
|实际Electron主进程IPC→本地HTTP模拟|PASS|两轮模型请求，140→143只提交一次，history仅user/assistant，无审计混入|
|实际Electron会话重载|PASS|文档一致、请求不重复、旧提案不可执行、分数仍143|
|Windows真机/真实账户联网|NOT TESTED|Linux及模拟不能代替|
|file://浏览器|BLOCKED|当前管理策略阻止文件导航|

原生环境Electron44.9.0/Chromium152，Linux，1920×1080 DPR1，errors=[]。证据artifacts/ai-conversations/results.json及opencode-settings/approval/receipt/conversation/restored.png。所有数据为模拟，无真实学生和云端费用。

构建：独立离线HTML和Windows ZIP；完整构建与最终CRC/SHA检查随发行回执记录。不能把构建成功当Windows真机启动通过。

截图/发行：https://drive.google.com/drive/folders/1Ii4GfUH8yI7E-A12SlicBZXUjMecUeue

最终发行验证：Windows ZIP完整CRC通过，150448589字节，SHA-256 `1b2fb3a544ec5f3ddf73179ef7f1ea3b657c4efb192a3ddbc84b97e1f79988a5`。ASAR内HTML与同步资源逐字节相同、SHA匹配、版本3.0.76、history白名单实际存在，开发探针未打包。分卷.001/.002及Merge-and-extract-3.0.76.cmd、SHA256SUMS.txt已上传上述Drive目录；将四个文件放同一目录运行CMD。Windows真机状态仍NOT TESTED。
