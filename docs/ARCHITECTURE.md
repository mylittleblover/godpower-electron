# Electron 0.2.0 架构

当前同步 HTML 应用版本：3.0.46；来源提交 `mylittleblover/godpower-html@4628419c7c0bd40d5a718a867bdc3976d86cfd5d`，SHA-256 与同步结果见 `docs/validation/v3.0.46-electron-sync.md`。HTML已把标题卡下方首页内容接入统一只读网格；可视编辑器及插件启停管理尚未完成。

## 模块职责

| 文件/目录 | 职责 |
|---|---|
| main.cjs | 单实例、启动校验、菜单、全局 Ctrl+Shift+P、退出 |
| desktop/windows.cjs | 主/悬浮/演出窗口生命周期、IPC 角色授权、显示器选择、广播 |
| desktop/contracts.cjs | 精确 sender/mainFrame/URL 验证、命令白名单、只读 DTO 清洗 |
| desktop/broker.cjs | 唯一命令转发、主窗口 epoch、客户端序号与有界去重、超时和失效 |
| desktop/escape-lease.cjs | 临时 Escape 注册所有权，重复就绪不丢失清理责任 |
| desktop/window-state.cjs | 窗口配置校验、原子写、可见屏幕约束 |
| desktop/protocol.cjs | 静态资源白名单、CSP、自包含 HTML SHA-256 校验 |
| preload/desktop.cjs | sandbox 下按 role 暴露窄 API，不暴露 require/Node/任意 IPC |
| renderer/picker.* | 悬浮窗表现及输入；没有 RNG、课堂存储或计分内核 |
| renderer/effect.* | 只展示已确认 DTO；入场/揭晓/退场/跳过，无业务写入 |
| scripts/sync-html.mjs | 验证已提交源码、重建产物、记录来源和 SHA-256 |
| desktop/*-probe.cjs | 仅开发测试，打包排除；正式程序拒绝测试参数 |

HTML 源码侧 `core/picker-bridge.js` 提供 snapshot/command/notify，直接调用原 startSlotSpin、stopSlotSpin、applyScoreDelta。`ui/electron-host.js` 是唯一传输适配器；普通浏览器无 preload 时不激活。旧 stop 包装器的有效历史写入合并到原停止函数，避免重复停止增加历史。

## 一次操作

悬浮窗 command → preload 附加主 epoch、辅助窗 transport UUID、序号 → 主进程验证 → Broker 去重 → 主 renderer 执行唯一 GodpowerPicker.command → 原业务函数 → 持久化和 UI → snapshot + 确认返回。

开始时原算法确定一次结果；rolling 的 DTO 隐藏结果。stop 只确认一次，防重复池和历史仍用原格式；settling 约一秒只做视觉减速，revealed 才允许赋分并创建特效窗。双层抽选保留原有学生候选池及预选组规则，不改为新的分组概率。

赋分请求必须绑定当前 resultId；成员删除、state groups 替换、导入和撤销后旧结果失效。导入和历史恢复会显式取消瞬时转轮，不重抽、不重算。保存失败维持原程序的未保存提示和备份策略，返回 persisted:false；IPC 从不自动重试。

## 故障语义

- 重复请求返回同一 receipt；序号过期或 ID 内容冲突拒绝。缓存驱逐后旧序号仍不能重放。
- 辅助窗 reload 使用新的 transport UUID，旧在途请求终止确认，新序号可用；旧命令不会重发。
- 主窗口 reload/crash 更新 epoch，所有 pending 确认失败，辅助窗显示未就绪。恢复只读取原存档；不恢复未确认随机抽选。
- 快速 close/open 在 closed 事件后重建，避免对正在关闭的实例 show。
- 崩溃的辅助窗销毁后可重新打开；主窗口崩溃通过悬浮窗「主窗口」恢复。
- 特效唯一实例，替换/跳过/销毁/显示器变化清除窗口、watchdog、Escape 所有权。旧窗 finish 必须同时通过 sender 和 resultId 校验。

## 数据和权限边界

主 origin 保持 `classroom://app`，沿用 defaultSession 和 userData 路径。picker/effect 为独立 `classroom://picker` / `classroom://effect` origin；不能读取主 localStorage/IndexedDB。主窗口仅发布姓名、组色、分数、点名历史及必要视觉设置，口令、存档快照和音频资源不广播。

所有窗口 contextIsolation/sandbox/webSecurity 为 true，nodeIntegration 为 false；禁止新窗口、webview、远程 HTTP/WebSocket、任意导航和权限请求。动态名字通过 textContent 写入，辅助页面没有 unsafe-inline script 权限。SHA-256 用于产物一致性校验，不替代发布签名。

## 窗口和声音

桌面配置保存在 userData/desktop-windows-v1.json，包含 pickerBounds、alwaysOnTop、effectsEnabled、displayId；不更改课堂 Schema。原子写失败会显示仅会话生效错误。屏幕移除后窗口重夹到可见 workArea；特效使用指定 display.bounds，覆盖普通应用，不申请系统独占权限。

演出窗 focusable:false、showInactive，默认鼠标穿透，跳过按钮悬停时通过受限 IPC 接收点击，退出恢复穿透并销毁。全局 Escape 仅在演出期间注册；若注册失败，按钮仍可跳过。

原 getAudioContext/startRollLoop/stopRollLoop/playSound 继续在主窗口执行。远程操作接入原 ui_button_pick_start/pick_stop/positive/negative/settings 等自定义音效槽，原抽中音效只调度一次；自定义音频、随机多音效、音量和音乐库无需拷贝。backgroundThrottling:false 和 autoplayPolicy 允许最小化课堂继续调度。真实设备听感与 Windows 混音需人工验收。

## V3.0.57：内部功能弹窗与独立点名

主窗口唯一拥有课堂状态，关闭隐藏并保持后台；托盘恢复或彻底退出。普通积分、口令、查询、道具、举手、名单、确认和结算弹窗全部在主窗口原生DOM中显示。已删除DetachedWindows、window renderer/preload角色及classroom://window资源路由；不再使用每120ms克隆HTML并回放输入的桥接。

点名继续使用同一个BrowserWindow在72×72图标和面板之间切换，位置/尺寸仍持久化。展开以图标当前位置为锚点并限制在显示器工作区；面板尺寸保持用户设置。Pointer Events把鼠标/触屏screen坐标通过授权IPC传到主进程；坐标有限值校验、4px拖动阈值、每帧合并移动、结束时最终提交。无系统鼠标光标轮询。轻点展开，拖动不会误展开。

主程序底栏点名按钮显式请求展开，反复点击也能重开已收起面板。隐藏的旧点名DOM不参与内部弹窗焦点锁。悬浮窗编辑输入期间失焦不会立刻收起，防止系统键盘取焦造成退出；其他失焦继续收起。

全屏点名/赋分特效仍通过透明独立窗口展示已经确定的结果。抽取、计分、音频、随机数和数据持久化均继续在主窗口执行，不增加另一套业务状态。contextIsolation、sandbox、webSecurity及窄preload保留。

## 3.0.1 外观主题与提示

主课堂唯一拥有GodpowerTheme，theme通过现有Picker DTO同步。contracts.cjs只接收classic/marx，旧快照回退classic；theme.cjs将白名单映射到本地图标和名称，无法传入任意本机路径。Windows.updateBranding更新窗口/托盘而不改变appId、userData或业务状态。Linux无法使用ICO作为部分原生窗口运行时图标，经典PNG由原ICO无损生成；Windows安装ICO保持不变。

picker渲染器只消费theme并更新红/暖白/金外观；effect消费已确定结果及theme，正分仍绿负分仍红。独立工具窗口从主课堂snapshot获得bodyClass，再同步body与html的theme状态，保证继承的原始样式与根背景一致。点名悬浮窗三个布尔开关使用与课堂一致的轨道尺寸，原事件入口不变。

sync:html从已提交HTML源码同时读取tooltips.js/css，写入renderer并记录SHA-256。picker/window通过classroom协议白名单加载同一实现；禁止手改该派生文件。没有新增Node或通用IPC权限。

版本统一3.0.1：HTML包/顶栏/运行时/备份appVersion由单一package token构建；Electron package与HTML一致后才允许verify:bundle/build。发行校验逐个比较asar源码和HTML SHA，包含两个运行时图标及共享提示资源。
