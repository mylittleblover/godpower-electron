# 3.0.74 OpenCode优先AI助手：Electron验收

HTML来源1d88d56325b5f656c0726effc042bc7bd6ef6def，12888387字节，SHA256 62d6d88d359dc358f22a08d8dc34dfe61d8324b6f7c77dcca4e1b0956e98071b。源/包/锁/可见版本均3.0.74；不直接修改resources/index.html。

## 实现

主进程desktop/ai-gateway.cjs负责固定端点、Bearer、受限JSON、30秒超时、取消、单并发、每分钟10次、请求ID短期去重及65KB响应上限。OpenCode当前Console/Go与旧Zen/Go地址均明确区分，不伪造OpenCode客户端身份、不绕过免费模型或账户权限。另支持OpenAI/DeepSeek/OpenRouter/Ollama。

preload仅main角色开放冻结的ai.status/configure/request/cancel/clear；gp:ai在访问配置或网络之前验证主窗口身份，其他窗口没有AI接口。保持contextIsolation/sandbox/webSecurity、原CSP和渲染器网络拦截。主进程使用Node fetch，不向渲染器开放通用HTTP代理。

配置文件ai-settings.json与课堂档案分离，仅存提供商/模型和可选safeStorage密文；默认密钥仅主进程内存。不使用Linux basic_text持久化密钥。输入后清空UI，不通过status返回密钥；不把密钥写入日志/课堂备份/对话。共享初始读取Promise与串行配置/清除，避免密钥清除后被迟到读取恢复。主窗口重载/崩溃/退出取消请求。

课堂动作仍在主renderer通过AIToolGateway和原ManualScoreCommands完成；主进程不产生额外课堂状态或抽选算法。

## 实际执行

- npm test：94 PASS、0 FAIL；含OpenCode四种地址/Bearer、授权/匿名模式、未知参数拒绝、响应上限、取消、去重、频率、配置清除竞态、初始读取清除竞态、加密存储端口重新打开和preload角色限制。加密端口测试使用测试加密实现，不冒充真实Windows密钥存储验收。
- verify:bundle：PASS，来源、SHA、共享资源与各处版本一致。
- DESKTOP_SCENARIO=ai npm run test:desktop：PASS，真实LinuxElectron44.9/Chromium152/Xvfb+xfwm4，1920×1080 DPR1；实际主窗口UI→受控IPC→Node本地HTTP模拟服务→提案→教师确认→一次既有课堂命令，积分140→143；实际清除后主进程keyPresent=false。errors=[]。
- 测试probe不进入发行；本地模拟服务重定向仅在测试文件注入，产品只访问固定端点。
- 真实OpenCode云端、账户余额/配额/模型权限：NOT TESTED，无用户密钥、未调用收费模型。
- Windows真机、系统安全存储、PPT/多屏/软键盘与真实听感：NOT TESTED。
- 网页HTTP场景及449单元/集成PASS；file://被当前Chromium管理策略阻止（BLOCKED），详见HTML同名报告。

截图artifacts/ai-assistant/opencode-settings.png、opencode-approval.png、opencode-receipt.png；模型响应来自本地模拟服务，不声称云端已联通。

## 使用

设置→AI助手，选择OpenCode连接类型、账户可用的模型标识并输入API Key；保存不发送请求。AI页选择模型对话，每次勾选本次发送授权；需要课堂数据时另勾匿名积分。改分还需再次确认。没有模型/密钥可使用明确标注的离线规则助手。对话不自动持久化或上传历史；动态教学工作区/知识库/多轮自动上下文尚未实现。

资料与交付目录：https://drive.google.com/drive/folders/1NtRXzr4-G6tNG871m-Q3Bep4jWQwNFyb

Windows x64 ZIP交叉构建及全文件CRC：PASS；包内AI主进程模块/preload存在，HTML字节与来源提交完全一致：PASS。ZIP 150443988 字节，SHA256 17aeaec04c7f28c3e160126e4c714da55fede49488d1b0c744b711f274e8b797。Windows真机仍NOT TESTED。
