# 逐文件遗留代码与目标模块映射

分类说明：保留＝现有能力仍是有效行为/资源；适配＝保留入口和兼容语义，由目标模块接管；迁移＝逐步移动至明确领域所有者；删除候选＝满足引用、差分和回滚证据后才可删除；待动态证明＝静态检查不足以安全分类。没有文件仅因编号或版本号就列为可删除。

## HTML 构建和新增模块

| 现有路径 | 当前职责 | V3 目标 | 分类/依据 |
|---|---|---|---|
| src/index.template.html、src/manifest.json | 页面、弹窗、脚本顺序、源码资源清单 | Presentation shell、路由、组件装配 | 保留并渐进拆分；单文件离线构建必须保留 |
| src/core/reliability.js | schema 1 校验、归档校验、规范化、防御失效订阅 | Domain constraints + Storage Port contract | 迁移，先保持 schema/key |
| src/core/commands.js | 注入式命令生命周期、忙状态、取消、失败恢复 | Application command bus/transaction coordinator | 保留边界并扩展到未接入旧写入口 |
| src/core/classroom.js | 判题/道具公开命令、备份导入和旧系统适配 | Competition/Session use cases | 适配并分域迁移；仍接入全局旧状态 |
| src/core/history.js | 操作前快照、旧键写入、恢复与撤销 | Event/ledger + compensating commands | 迁移；撤销语义和快照字段需保持 |
| src/core/item-score.js | 道具计分、防御优先级 | Items/Effects domain services | 保留纯规则，扩展纯测试 |
| src/core/picker-bridge.js | 唯一点名快照与命令入口 | RollCall application port | 保留；Electron 辅窗不复制随机算法 |
| src/core/action-sounds.js | 按按钮/操作分配音效槽 | Media/Audio port | 迁移；播放不能成为领域规则 |
| src/core/item-module-model.js、item-modules.js | 道具配置校验、存储和 UI 通知 | Items configuration + adapter | 迁移，兼容当前配置 schema |
| src/items/catalog.js | 26 个道具目标、效果和限制蓝图 | Item definitions | 保留为唯一目录 |
| src/items/draw.js | 首轮举手池、榜首喇叭概率、权重/冷却/防重复 | Draw policy service | 迁移；注入 RNG 但保持调用顺序和分布 |
| src/items/operation.js | 目标选择、效果、消耗、统计、续用和反馈 | Item use cases + target/effect/defense blocks | 渐进迁移，抽取流程和运作流程分离 |
| src/ui/model.js | 首页、排行、历史差异纯读模型 | Domain selectors/read models | 保留并分域 |
| src/ui/render.js、battle-grid.js | 唯一 renderAll/renderGrid、比赛卡片和状态表现 | Competition presentation | 适配；14组几何作为不变基线 |
| src/ui/battle-motion.js、classroom-feedback.js | 道具/积分/点名表现、六个自由赋分槽、按钮声音 | Presentation effects/audio orchestration | 迁移；只呈现已提交事件 |
| src/ui/desktop.js | 历史、档案、设置、弹窗和导航编排 | 按业务页面拆分 | 拆分迁移；保留 DOM ID 和旧设置处理器 |
| src/ui/welcome-v2.js/css | 首页、内容卡片、日历轮换和动效 | Welcome/Teaching workspace | 迁移，题库不写比赛状态 |
| src/ui/electron-host.js、electron-windows.js | HTML 到 preload 的桌面窗口适配 | Platform adapter | 保留安全边界；HTML host 对原生能力显式降级 |
| src/ui/themes.js/css、tooltips.js/css | 主题、提示生命周期和显示 | Theme/Localization/Presentation infrastructure | 迁移；共享显示契约 |
| src/resources/asset-000..026.txt、scripts/build.mjs | 27个原始图片资源及内联单文件构建 | Asset pipeline | 保留和校验，不新增 CDN/服务器依赖 |

## HTML 编号遗留脚本逐文件映射

| 文件 | 已见职责/模板标识 | 目标模块 | 分类 |
|---|---|---|---|
| script/00.js | 主状态、存储、比赛、点名、音频、道具目录、历史/封神榜、旧UI；6,000行以上 | Competition、Roster、RollCall、Storage、Audio、Archive | 适配/拆分迁移，绝不整体删除 |
| script/01.js | 旧核心渲染和 useItem 包装 | Render/legacy adapter | 待动态证明；已记录多层历史覆盖 |
| script/02.js | modernFlatV217Style | Theme | 迁移为 token/component styles |
| script/03.js | 欢迎统计、道具演出 | Welcome read model + effects | 迁移 |
| script/04.js | 强力蘑菇可见分、道具音频接管 | Effects + Audio | 适配 |
| script/05.js | 防御链、百科 | Item defense + encyclopedia | 规则/说明拆分 |
| script/06.js | 抽取音效停止 | RollCall presentation/audio | 适配 |
| script/07.js | 道具权重、库存清除 | Draw policy/Inventory | 迁移 |
| script/08.js | 权重调校 | Draw policy | 保留参数 |
| script/09.js | 每道具声音 | Audio settings | 迁移 |
| script/10.js | BIN 音频包导出/导入 | Media adapter | 保留旧包兼容 |
| script/11.js | 音效音量 | Audio settings | 迁移 |
| script/12.js | 每题使用限制、All In、legacyUseItem 覆盖 | Competition guards | 迁移并测所有入口 |
| script/13.js | 批量 All In 限制 | Competition command | 迁移 |
| script/14.js | 抽取冷却 | Draw policy | 迁移 |
| script/15.js | 闪电/墨汁计数单位 | Draw/effect timing | 保留计数单位 |
| script/16.js | 快速道具流程 | Items UI/use | 抽取和使用分开 |
| script/17.js | 攻击效果、积分重绘和排序 | Battle renderer/motion | 适配 |
| script/18.js | 百科效果文案 | Item encyclopedia | 迁移到目录单一来源 |
| script/19.js | 小组配色 | Roster/theme | 迁移，保留保存的组色 |
| script/20.js | 刺龟壳抽取冷却 | Draw policy | 保留冷却语义 |
| script/21.js | 库存重复清洗 | Inventory normalizer | 迁移 |
| script/22.js | 花类次数持久化 | Inventory/effect schema adapter | 适配旧数据 |
| script/23.js | 卡片重排稳定性 | Competition presentation | 适配；14组保护 |
| script/24.js | 当前排名预览和卡片显示排序分离 | Ranking read model | 迁移 |
| script/27.js | 排序契约 | Competition ranking | golden tests 后迁移 |
| script/28.js | 回合状态 FLIP | Presentation motion | 迁移，动画不控制状态 |
| script/30.js | 主题弹窗接口 | Dialog service | 保留/迁移 |
| script/31.js | 分数视觉动画及旧道具包装 | Score presentation + compatibility | 拆分 |
| script/32.js | 小组状态规范化修复 | DTO/schema normalizer | 迁移 |
| script/34.js、35.js | Toast 时长及防御提示层级 | Notification service | 合并迁移 |
| script/36.js | 手写流程、持续状态、旧道具包装 | Effects/Competition/adapter | 拆分，保留规则生命周期 |
| script/37.js、38.js | 小组道具说明、百科文案 | Item content/view model | 单一目录数据源；差异核准前不删 |
| script/39.js | 底栏趣味文案 | Localization/presentation copy | 保留文案后迁移 |
| script/40.js | 版本占位符 | Build metadata | 由 package 单一来源接替 |
| script/41.js、43.js | 文案清理/可见文案保护 | Localization/input validation | 迁移 |
| script/42.js | 火花/冰花规则与 legacyUseItem 包装 | Item domain | 保留规则，禁止未经批准改平衡 |
| script/44.js | 封神榜后状态清理 | Season settlement | 事务化迁移，不得丢数据 |
| script/45.js | 完整档案快照 | Archive | 事务化迁移，档案成功后再重置 |

编号脚本缺失的 25、26、29、33 等不能据序号判成死代码；当前模板不引用，但要在历史基线/构建清单核对后才可列删除。

## HTML 样式文件映射

| 文件范围 | 当前用途 | 目标/分类 |
|---|---|---|
| style/00.css、01.css | 旧基础与组件样式 | Base/tokens；逐组件截图确认后迁移 |
| style/02.css | 主主题、底栏规则 | Theme + competition shell |
| style/03.css–06.css | 可读性、轮盘、百科 | Item/UI component styles |
| style/07.css–12.css | 库存、声音设置、回合状态、快速操作 | Settings/Item/Round components |
| style/13.css | 比赛底栏几何 | Competition layout；14组保护 |
| style/14.css–18.css | 组色、扁平UI、排名预览、弹窗、计分动效 | Tokens/components/motion |
| style/19.css–23.css | 通知、计划、道具文案和底栏文案 | Notifications/items/localization |
| ui/*.css | 新主题、首页、桌面、窗口、动效 | 新样式权威；与编号 CSS 逐块消重 |

既有静态报告记有 1,657 处 !important；这只是历史统计，未重算，不能据此删选择器。

## Electron 文件映射

| 路径 | 当前职责 | V3 目标/分类 |
|---|---|---|
| main.cjs | 单实例、菜单、全局快捷键、托盘、退出 | Electron Shell；保留，不放领域逻辑 |
| desktop/windows.cjs | 主/浮窗/演出窗、IPC、显示器、生命周期 | Platform window adapter；拆服务 |
| desktop/contracts.cjs | sender/role 验证、消息 DTO 清洗 | Capability/security gateway；保留 |
| desktop/broker.cjs | 命令去重、epoch、序号和超时 | Application transport adapter；保留 |
| desktop/detached.cjs | 独立功能窗口、DOM输入和文件返回 | Presentation window host；保留受控协议 |
| desktop/escape-lease.cjs | Escape 注册所有权 | Window lifecycle utility；保留 |
| desktop/window-state.cjs | 窗口几何配置原子写和可见屏限制 | Desktop preferences adapter；保留 |
| desktop/protocol.cjs | classroom 自定义协议、CSP、资源校验 | Secure asset host；保留 |
| desktop/theme.cjs | 主题枚举到本地图标/窗口名映射 | Theme platform adapter；保留 |
| preload/desktop.cjs | role-based 最小 IPC API | Capability SDK boundary；保留并版本化 |
| renderer/picker.* | 浮窗UI；请求主进程唯一抽选 | RollCall presentation client；保留，无 RNG/计分 |
| renderer/effect.* | 展示已确认的点名/分数事件 | Presentation client；保留，无业务写入 |
| renderer/window.* | 独立窗口节点同步/事件回传 | Detached UI host；适配为组件协议 |
| renderer/tooltips.* | 三秒辅助窗提示 | Presentation utility；保留 |
| scripts/sync-html.mjs | 验证 HTML 源提交并复制/记录 SHA | Build pipeline；保留 |
| scripts/verify-bundle.mjs、verify-release.mjs | 版本、源码和资源完整性 | Release integrity；保留 |
| scripts/smoke.mjs、desktop-test.mjs、windows-smoke.mjs | smoke/真实Electron/Windows测试 | QA harness；保留 |
| scripts/prepare-drive-release.mjs | Drive 分段包工具 | 可选发行工具；暂留 |
| resources/index.html、BUILD_INFO.json | HTML 发布快照及来源 | 生成产物；禁止手改 |
| build/icon.ico、classic-icon.png、marx-icon.png | 安装/运行图标 | Theme assets；保留 |
| desktop/*probe.cjs | 测试故障注入/探针 | Test-only；发行打包排除 |

## 当前可删结论

当前没有可直接安全删除的运行时代码。公共 useItem 已转到 ItemOperationBlocks，但遗留执行器仍有 14 个 legacyUseItem 定义写入点；任一包装器可能包含仍有效规则、动画/音频副作用或间接入口。只有新旧行为差分、静态和运行时引用扫描、分模块回归以及回滚件齐备后，重复委托片段才成为删除候选。
