# 3.0.0 道具积木与首页内容更新

HTML 源码：mylittleblover/godpower-html，feat/item-building-blocks。功能提交99983e4，文档验收提交8821c8e；随包HTML哈希b2cf49e73ba9e1105d66f28ced5c71e22df8e61fc43527809984ed2a2ca242b5。

新增26道具蓝图，分别拆开抽取与运作积木，并在设置中单独配置。首页知识点/挑战支持独立轮换，知识与题目支持表单编辑和JSON文件导入导出；百科跳转已修复。小组编号在饱和组色上优先使用白字，只调整徽章显示底色，不改动存储组色和14组布局。

验证：HTML单元/集成131通过、26基础道具通过、464道具防御对比通过、448种子抽取对比通过、27异步防御通过；首页内容与配置专项通过。Electron单元15通过、真实桌面场景15通过（1920×1080/1×，Linux Chromium152）。Windows真机仍NOT TESTED。file://被浏览器管理策略阻止，记录BLOCKED；Electron自定义离线协议运行通过。

`node scripts/prepare-drive-release.mjs` 将Windows ZIP分为每段最多90MiB，生成ASCII文件名和CRLF合并脚本，避免中文命令脚本被Windows代码页错误解析。脚本先合并并校验SHA-256，再解压；不会执行程序或更改课堂数据。

Windows x64 ZIP实际构建及解压完整性校验PASS；147133090字节，SHA-256 d653ec7937293256e38ffa86bc3aeea57e57259454800f7c62ead55f2ab4e6b7。90MiB+52761250字节分段能逐字节重建原ZIP；不把此构建验证称为Windows真机启动通过。
