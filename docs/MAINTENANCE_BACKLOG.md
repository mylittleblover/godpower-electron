# Electron 维护列表

本次没有已确认未修复的 P0。每次发现缺陷更新此表；修复必须链接回归证据；每次版本发布复核 P0、原生平台矩阵和源码 SHA；CI 未运行不能计为通过。

| 编号 | 优先级/状态 | 具体任务、证据与影响 | 修复方案/依赖/复杂度/风险 | 验收与测试 |
|---|---|---|---|---|
| EL020-01 | P1 / 环境阻塞 | Windows 原生 EXE、NSIS、portable 尚无实际启动证据 | Windows 主机执行 README 命令，运行 scripts/windows-smoke.mjs；依赖 Windows 环境；中；风险为平台特性未验证 | 三模式、独立效果、加分、重启、安装卸载全部有真实记录；旧0.1 userData保留 |
| EL020-02 | P1 / 环境阻塞 | Linux Wine 无 IA32 helper；installer.log 显示 rcedit-ia32 无法执行 | 优先在 Windows 构建签前产物；或提供支持 WoW64 的构建环境；依赖01；中；不能通过更名工具或删除功能掩盖 | npm run build:win 成功，安装卸载并重开课堂数据无损 |
| EL020-03 | P1 / 待硬件验收 | 真实 PPT、投影仪、负坐标屏幕和混合 DPI 尚未验证 | 按报告逐项测试；如有偏差只修 WindowManager；依赖01；中；风险是图层或焦点异常 | 演出只覆盖所选屏、Esc/跳过生效、拔屏后可见，焦点回到正常应用 |
| EL020-04 | P2 / 待人工验收 | 自定义槽只验证单次调度和资源读写，未验证听感 | 主课堂上传 start/stop/win 多候选音频，最小化后以真实设备听辨；依赖01；低；浏览器/音频设备差异 | 正确音量、随机候选、不叠声、关闭时无残音；记录设备和采样 |
| EL020-05 | P2 / 未开始 | Windows 发行物未配置代码签名；完整性 SHA 不等于签名 | 用户确定证书和发布策略后实施，禁止自动购买；依赖01；中；证书和版本身份维护 | 签名验证、离线启动、升级后 userData 路径及 origin 不变 |
| EL020-06 | P3 / 待测量 | HTML 全局状态仍需每120ms只读观察；超大名单 DTO 未进行持续性能测量 | 对14/100/1000组测序列化/IPC频率，再按事件节流；无依赖；中；不能漏掉旧全局入口的数据更新 | 14组同步延迟稳定、1000组无长期积压，比较前后真实CPU/内存 |

## 已完成的可追溯修复

- EL020-R01：停止逻辑合并历史写入，删除旧 stop 包装器，重复 stop 不重复记录。HTML picker 回归。
- EL020-R02：快速关闭后立即重开改为等 closed 后重建。regressions/rapid-reopen-before-fix.json 与最终12场景。
- EL020-R03：辅助窗每次加载创建 transport UUID，刷新后新序号可用，旧消息拒绝。regressions/picker-reload-before-fix.json 与最终回归。
- EL020-R04：EscapeLease 管理注册所有权，重复 ready 不丢失注销。Node12项及真实窗口重复 ready 回归。
- EL020-R05：验收脚本 setup 异常写 FAIL，强制全部12场景执行，禁止空结果 PASS。setup-before/after 故障注入。
- EL020-R06：导入/撤销/替换成员后取消或拒绝旧抽选目标，赋分不越过原主课堂锁。

下一阶段按 EL020-01、02、03、04、05、06 的顺序领取。保留 HTML 唯一业务内核，新增辅助窗不得复制 RNG、存储或积分计算，不允许为方便开发开放完整 IPC/Node。

## 原生窗口增补维护任务（2026-10-18）

| ID | 优先级/状态 | 任务与证据 | 验收标准 |
|---|---|---|---|
| NW-01 | P1 / NOT TESTED | Windows 托盘、真实鼠标拖动、PowerPoint 叠加及双屏；Linux 无法证明 Windows 行为 | 隔离用户目录下记录关闭主窗口继续点名、托盘恢复/退出、跨屏拖动、指定屏幕演出 |
| NW-02 | P2 / 待处理 | `renderer/window.js` 全窗口快照替换，尚非增量组件渲染 | 在 12 类窗口、快速输入、口令、刷新及撤销行为不变时，记录传输量与长任务并替换局部节点 |
| NW-03 | P2 / NOT TESTED | 辅助窗口内实际大文件选择/系统文件对话框，Windows 未验证；音效上传已在 Chromium 验证 | 测试自定义图像、音频、导入失败、取消选择、大小限制反馈，不覆盖真实数据 |
| NW-04 | P2 / NOT TESTED | 全屏自定义音效人工听感与长文件中断 | 人工验证音量、停止滚动与揭晓衔接、快速连续演出及跳过长音频，记录结果 |
| NW-05 | 已完成 | 输入序号按 renderer session 隔离；快速输入提交、密码本地保留、关闭再开/刷新回归 | 见 `artifacts/detached-windows/results.json` |
| NW-06 | 已完成 | 独立窗口内容区隔离主页面边距，修复按人赋分顶部裁切；入退场动画独立 | 各窗口 DOM 边界及截图见同目录 |


## EL-THEME-301 主题及原生窗口同步
- 分类：UI/IPC；优先级P1；状态DONE。
- 问题：HTML主题需同步到独立点名、特效、工具窗口与原生标题/图标。
- 证据：desktop/theme.cjs/windows.cjs/contracts.cjs；renderer/window.js、picker.js；artifacts/marx-theme。
- 影响：三个角色和全部工具子窗口；不更改抽选或计分。
- 方案：严格theme枚举DTO、内部图标映射、根节点主题同步、跨平台PNG运行图标、原图标ICO保留。
- 依赖：HTML主题API；复杂度中；风险：Windows实际任务栏缓存行为仍需真机观察。
- 验收：原15案例不退化，新增第16案例检查主题、原生setter、重载、积分语义和实时恢复；20单元测试通过。
- 推荐测试：npm test与DESKTOP_ARTIFACTS=artifacts/marx-theme npm run test:desktop。

## EL-THEME-302 Windows真机主题与任务栏验收
- 分类：兼容；优先级P2；状态NOT TESTED。
- 问题：Linux Electron与WindowsZIP构建不能证明Windows任务栏图标缓存、多显示器或安装行为。
- 证据：当前Linux环境；本轮发行报告。
- 影响：Windows图标/托盘/跨应用覆盖。
- 建议：在真实Windows用隔离课堂数据逐项切换主题、重启、恢复背景运行并检查任务栏/多屏。exe文件自身固有图标不会随运行时主题切换。
- 依赖：EL-THEME-301；复杂度低；风险：禁止以Wine或Linux图像替代真机结论。
- 验收：记录Windows版本、DPI、显示器和照片/截图；正确标记失败。
- 推荐测试：GODPOWER_WINDOWS_EXE配合现有Windows smoke及人工任务栏检查。
