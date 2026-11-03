# 原生举手迁移（开发检查点，未发行）

一行一组浮窗名单复用主renderer的HandFlow/HandRaisePort。选择后在指定显示器的独立透明effect窗口显示正确/错误与三奖励；六预设和自由整数经同一Broker命令保存。奖励完成即禁止再领取。全屏抽取只有已确认结果的滚动/揭晓，使用道具复用原生演出。

安全：effect只获得当前卡牌的handAction，主进程验证角色、精确主frame/URL、effect id、当前groupId/selectionId及saveContext。禁止任意命令，Broker继续负责幂等/序号/超时；主renderer还验证会话与实际课堂规则。没有新增Node、文件或完整IPC权限。手势关闭/超时只退出展示，已接受业务不重复执行。

验证：23项相关单元PASS；DESKTOP_SCENARIO=hand DESKTOP_ARTIFACTS=artifacts/hand-flow/native npm run test:desktop 实际1个完整命名场景PASS，包含判定/奖励/赋分ACK/跨组攻击拒绝/新会话抽取/重复领取拒绝/使用道具演出。其余20个桌面场景本阶段NOT TESTED；默认测试仍要求21个。环境Linux Xvfb/xfwm4、1920×1080 DPR1，Windows/PPT/多物理屏幕NOT TESTED。未新打包或上传Drive。

下一步继续M4–M7。当前旧版3.0.69发行物不包含这些未发行功能。
