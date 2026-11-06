# 3.0.77 联网资料验收

HTML来源806a940，完整SHA与共享资源校验见resources/BUILD_INFO.json。AMR固定https://amr-link.open-design.ai/v1/chat/completions，仅deepseek-v4.1-flash，禁止重定向及自动换模型。没有保存或发布用户测试密钥。

## 已完成

AI页增加高中学科资料窗口、学科筛选、资料查看、TXT/MD/JSON原子导入、导出、删除及本机恢复。请求可逐次选择本地摘录、联网关键词和历史；不会自动发送整个资料库或真实名单。研究模式双端强制actions=[]，不影响普通确认计分。

联网仅固定Bing RSS及必要时的维基百科API摘要，不抓取结果页面；相关性/教育官方及开放来源域名过滤，10秒/512KB/最多5结果。搜索不带模型密钥。失败明确返回，不偷偷转为“已联网”无来源回答；搜索完成后取消/代次检查先于模型请求。来源卡由宿主生成，链接由主窗口专属openSource代理校验后交系统浏览器，应用远程导航仍禁止。

## 验证

|项目|状态|证据|
|---|---|---|
|HTML完整单元/集成|PASS|459项|
|Electron完整单元/集成|PASS|104项|
|真实Chromium1920×1080 1x|PASS|资料浏览、单关闭按钮、导入、整批重复原子拒绝、刷新、确认删除、摘录范围、来源卡、研究不计分；HTML artifacts/ai-research|
|多对话回归|PASS|HTML ai-conversations专项|
|实际Linux Electron研究专项|PASS|本机模拟搜索/模型；来源参数、DeepSeek模型、无改分、外部来源代理及私网URL拒绝，errors=[]；本仓库artifacts/ai-research|
|真实AMR+公开搜索|PASS|仅一次deepseek-v4.1-flash，HTTP200，934输入/209输出/1143总tokens，模型2.97秒；live-deepseek-research.json|
|Windows真机|NOT TESTED|Linux和交叉构建不代表Windows运行|
|国内全部课本全文/PDF解析|NOT TESTED|没有此实现，不得宣称完成|

## 内容及网络限制

当前内置27篇项目原创通用高中参考、9项官方教材目录入口，九科全覆盖；不是所有版本逐册课本，也不含商业课本全文。国家平台入口本环境访问受限，不能冒充已下载。用户已有的合法资料可文字导入，PDF/扫描件/自动页码未实现。课本完整性、许可和学科准确性仍需进一步核验。

Bing中文查询实测偶尔无关，过滤后备用百科有429限流；英文photosynthesis chloroplast实网成功。只能保证正确报告失败，不保证第三方公开搜索稳定。模型回答按所给摘要和参考生成，引用号不是全文或教材页码证明。

## 发行

版本3.0.77，保持离线自包含HTML；资料浏览无需联网，云端模型/搜索由Electron受控代理提供。Windows ZIP及校验回执在最终构建后记录。

截图及下载：https://drive.google.com/drive/folders/1nykBTGmEPtBYfSd3CnhwnkYXXjtB06Lp

后续已记录：AI受控命令目录，优先小组和成员，再接道具抽取/合法使用；研究问答仍只读，扩展不能绕过历史/事务/All In及库存限制。

最终构建：Windows ZIP CRC PASS，150464490字节；SHA-256 `0226bd1e411faa882400acba3579862cd069d278ea424896893504b495372c38`。ASAR内HTML、AI代理/搜索、窗口主进程与preload逐字节匹配已测试源码。分卷001/002、合并解压CMD、校验文件、独立HTML与截图交付上述目录。Windows硬件运行仍NOT TESTED。
