# 3.0.73 头像同步与课堂窗口修复

HTML权威源码：mylittleblover/godpower-html@ee18ba2915f3c02ccfccb521a979b011ead6c137。同步脚本读取已提交源码，重新构建核对SHA-256：5d03e37e936a2e284d5eddc1bfdad5374821ab437f36f8442633589a9ff4c56c，12859345字节；版本3.0.73。

新增83宝可梦、38索尼克，84大乱斗名称核对；官方名称资料缺口保留于HTML报告，未冒称索尼克全角色已完成。

本次一并落地之前待提交的课堂修复：
- hand DTO携带受限本地图像itemIcon及小组序号；小组按钮显示序号和名字，去除重复判定按钮。
- 原生举手卡片同阶段busy只更新控制状态，避免重建闪烁；增加退出入口、小组头像、实际抽中道具图标；取消小组标题滚动区域。
- 复用举手效果窗口，普通分数/道具反馈不打断当前交互；只延迟最后一条视觉反馈，8秒过期且存档代次变化后丢弃，不重放业务命令。
- 原生联调实际发现：普通button默认type为submit，被控制同步误判为赋分表单按钮，JUDGE阶段因canScore=false被禁用。修正为仅真正属于表单的submit按钮参与赋分校验。新增组件断言先失败后通过，保留原生联调失败原因与组件测试失败日志，没有删除断言。

实测：
- verify:bundle：PASS，来源提交与资源哈希、各处版本一致。
- npm test：84 PASS / 0 FAIL。原有完整DTO严格比较加入受控itemIcon空默认值，未知字段丢弃及权限断言保持。
- node tests/hand-surface.mjs：PASS，1920×1080 DPR1真实Chromium，初始判定可用、busy不重建DOM且禁用、退出、头像、抽中图片解码。
- DESKTOP_SCENARIO=hand npm run test:desktop：PASS，实际Linux Electron44.9.0、Chromium152、Xvfb+xfwm4、1920×1080 DPR1。主窗口/浮窗联动、判定、奖励选择、一次赋分、重复奖励拒绝、切组、正式道具抽取/使用与头像特效；results.errors=[]。
- Windows硬件、PPT覆盖、多屏、触摸及真实听感：NOT TESTED。Linux日志含缺少系统D-Bus服务提示，不将其当成Windows验证。

截图：artifacts/classroom-hotfix73/，组件截图artifacts/hand-surface/。上传目录：https://drive.google.com/drive/folders/1XnksjaQVpWgnJaK9bNySsWmb5zDEgv7X。

Windows x64可执行程序ZIP交叉构建：PASS；ZIP全部文件CRC、EXE存在、asar内HTML与已提交源码完全相同、版本一致：PASS。ZIP 150433443 字节，SHA-256 971a07f9a2facaea417484cb3524ffef5b98c6053f7a6abae3318ac1d0411796。Windows真机启动仍NOT TESTED。
