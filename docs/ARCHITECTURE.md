# Electron 0.2.0 架构

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
