# 3.0.1 马克思主题与全局控件发行验收

分支feat/marx-theme；Electron起点c06e113，功能提交66180ed；HTML来源2ba6beddc8e6f2e948af8b9d07c23ecebffd43da。仅桌面1920×1080、1×，Linux Electron真实窗口；没有CircleCI操作。

## 功能

设置→外观与界面→应用主题选择“马克思的力量”。红色、暖白、金色红星麦穗风格；主窗口、点名图标/浮窗、全屏揭晓、独立工具窗口、原生标题和运行图标/托盘同步。保留原组色、正绿负红、计分和抽选唯一所有者。独立点名三个开关统一滑块；工具窗口同时同步html/body主题，根背景正确跟随。

主课堂同时提供金色发光封神榜按钮、高对比度到此为止、统一设置开关、3秒悬停提示、可跳过的主题切换演出。版本从包到顶栏、运行时、备份元数据均3.0.1，新增发布一致性检查。

## 真实结果

|检查|结果|证据|
|---|---|---|
|Electron单元|PASS20/20|artifacts/marx-theme/unit.log|
|真实Electron全部原15场景+主题场景|PASS16/16|results.json、runtime-final.log|
|主窗口1920×1080、1×、14组完整显示|PASS|battle14-dom.json/battle14.png|
|主题白名单、原生名称/图标setter、托盘映射|PASS|第16案例，nativeIconCalls4|
|点名重载、收起/展开、独立工具实时主题、三开关52×28|PASS|第16案例、marx-picker-*.png|
|独立工具html主题背景|PASS|第16案例、marx-native-score.png|
|正分绿色/负分红色特效、业务分数不被主题改变|PASS|第16案例、marx-positive-effect.png|
|HTML单元/集成|PASS131|上游docs/reports/MARX_THEME_3_0_1.md|
|HTML五页/8类设置/14组几何/3秒提示|PASS|上游artifacts/marx-theme|
|26道具基础场景、448固定种子抽取|PASS|上游logs/items.log|
|资源、版本及同步提示JS/CSS SHA|PASS|bundle.log、BUILD_INFO.json|
|Windows x64 ZIP构建与asar源码完整性|PASS|build.log、release-integrity.json|
|Windows原生执行、安装、任务栏实际缓存、多屏覆盖|NOT TESTED|当前Linux，没有Windows真机|

截图均由真实窗口capturePage生成。发现无头compositor可能返回旧帧后，新增先请求绘制、两帧边界及短暂稳定等待，再重新捕获；实际查看确认红/金点名、可读积分窗、绿+5效果。没有用截图生成替代业务断言。

早期Linux启动SIGTRAP由运行时直接加载ICO引起，已用从原ICO无损转换的classic-icon.png修复；安装ICO未改。runtime-final.log包含故意forcefullyCrashRenderer恢复场景的预期FATAL及瞬态disposed-frame诊断，不代表生产运行无日志。最终测试报告errors为空且16案例全部完成。

## 发行文件

WindowsZIP：上帝的力量-3.0.1-win.zip，147164417字节。

SHA-256：`bd8e91f8db71c237ebe119f813f12417e422b711edd150266715dbdf453845b5`

HTML：7877864字节，SHA-256`2ea0198f23cfcab3b5bd3ef8e3681882486f693f483a5ac85f18f946f46c9d0f`；27项原始内置资源保持完整。

Drive版本目录：https://drive.google.com/drive/folders/1_zAxZWwGH51Y-aDZG_WT7L-24aRrEhsY 。ZIP因连接器100MiB限制拆为90MiB分卷，下载001、002及Merge-and-extract-3.0.1.cmd到同一文件夹，运行cmd先校验SHA再解压。另提供单文件HTML及SHA256SUMS。保留原3.0.0目录，不更改共享状态。

Sites已发布站点版本12（应用版本3.0.1），source commit c99e3ec62b6109ba003dac4beb0b092b4597d5c7，deployment appgdep_6ad549684c608191a2c91b1454b2fd51 状态succeeded，原链接及仅所有者访问权限保持：
https://godpower-classroom-test.youziming233.chatgpt.site

## 限制

运行时图标切换不改exe文件本身的固有图标。WindowsZIP为完整解压运行包；本轮没有构建NSIS安装器，也未声称在Windows执行成功。file浏览器路径受环境管理策略阻挡，实际离线逻辑由自包含资源检查和Electron classroom协议验证，不能替代file真机测试。外观偏好独立存储，迁移设备需重新选择；真实用户14组布局设置未读取，使用合成固定基线。
