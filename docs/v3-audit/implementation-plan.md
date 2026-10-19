# V3 全项目实施计划（用户已批准，持续推进）

用户已批准实施，最新指令要求连续推进直至全项目完成。此处按依赖顺序记录阶段与证据；UI沿用 Chromium、1920×1080、1x，不执行 CircleCI。Windows原生、存储故障注入仍按专项验收，不能以截图替代。当前仅完成早期基础，不将阶段性进度称为全项目完成。

## 阶段和提交边界

| 子项目 | 目标与变更边界 | 主要验收/退出条件 | 回滚 |
|---|---|---|---|
| SP-00 | 冻结现状、功能/数据/行为和历史测试证据；仅文档/合成夹具 | 审计清单完成；Electron 16个桌面场景通过，含1920×1080 1x 14组 | 回退文档提交，无用户数据影响；截图见 `artifacts/v3-baseline/` |
| SP-01a-0 | 稳定 `groupUid`、`itemInstanceId`、`seasonId`；成就目录60项元数据 | HTML旧档导入、扣次/刷新、赛季归档重试和组身份专项测试；不改计分/道具参数 | 可回退兼容字段；当前阶段已完成，HTML日志记录证据 |
| SP-01a-1 | 命令事件 contract、actor/scope/revision、repository ports | contract测试通过；事件只在持久化提交后对外可见 | 事件contract及仓库原型已完成；生产异步事务入口尚未接通 |
| SP-01b | 逐项提取 ranking/score、defense、draw、operation 纯规则；旧代码仍保留 | 464 item-defense differential、448 seeded draw、26 oracle、14组基线不退化 | 每规则族一个提交，旧实现可切回 |
| SP-01c | 用旧 state adapter 把单一命令族接入统一 command/transaction | 保存失败、异步防御、撤销/恢复、重复请求/导入均原子一致 | feature flag/旧入口保留，逐类回退 |
| SP-02a | 存储后端 spike 与 schema ADR；不迁真实用户数据 | 已实现共享IndexedDB适配器并通过跨表事务/失败/重开/媒体导入；SQLite/原生ABI未作对照，生产切换待命令入口 | 丢弃隔离原型 |
| SP-02b | 旧键/DB dry-run importer 与冲突报告 | 所有来源可读取，数量/总分/档案/音频校验可复现；失败不写正式数据 | 删除临时目标库，源字节不变 |
| SP-02c | migration journal + 隔离profile事务导入 | migrationId幂等；任一步故障可重跑/恢复；旧数据哈希不变 | 回退目标库，保留源存储和receipt |
| SP-02d | 每个域单独切换读写权威 | 双写有期限和差异警报；验证通过再切下一域 | 关闭域开关，回读原留存副本 |

建议提交依次为：v3审计文档、纯领域contract、ranking/score、item defense/draw、单一命令适配、versioned dry-run importer、隔离事务导入、逐域切换。UI重做、多教师、插件、AI、VST3不与基础迁移混提。每个提交附差异证据、风险与回滚步骤。

## SP-00 冻结步骤

1. 记录两个开发分支和SHA、默认分支关系、包版本、Electron BUILD_INFO来源commit/SHA/字节数；证据标记为审计读取。
2. 由现有源码目录、功能清单和已有测试报告提取入口、调用、存储、异常、测试；未运行的报告不改写为本轮PASS。
3. 建立匿名14组fixture，包含长名、大分、负分、道具/状态/选项/All In；只承诺1920×1080、1x、double、顶部垫片120px的合成比较。
4. 固定26道具描述、ItemBlueprints、配置schema、differential oracle；保留测试断言和RNG/clock顺序。
5. 规定所有未来测试/迁移使用隔离profile，先确认namespace；不加载真实userData/localStorage。
6. 生成需求追踪、规则决定日志、迁移和风险清单；待裁定规则不得作为实现预期。

SP-00退出：26项可追到代码和现存oracle；全部存储键/表已登记；60项成就来源独立记录；14组差异基线有证据；数据失败回滚步骤与尚未决问题齐备。

## SP-01 领域和事务边界

目标模块：Identity/Classroom/Roster；Competition/Season/Session/Round；Items/Effects；RollCall；Settlement/Archive；Achievement；Application；Ports。Domain只做纯规则，不依赖DOM、Electron或数据库；Presentation只发命令、消费已提交事件；辅窗不能有抽签RNG或计分能力。

推荐操作流：验证 actor/scope/revision → 纯规则计算 → 一个事务提交 aggregate/ledger/history/season progress → 发布不可变确认事件 → UI/音频/动画响应。撤销采用补偿命令。命令ID、事件ID、因果ID、聚合ID、序列号、schema版本用于幂等和重放。

- 先以相同状态、时间和RNG对比原/新完整状态，包括分数、库存、状态、统计、历史、动画事件；抽取和使用严格分离。
- 防御的 pending/accepted/declined/cancelled/invalid 结果要明确；待定期间不能记有效命中/成就；防御消耗、分数和库存一次提交。
- 不改变现行All In、计分、26道具参数、冷却、空目标语义。新状态/道具规则等未批准细节不进入迁移。
- 成就先定义事件contract；60项 AchievementEngine 属后续独立子项。成就不操作分数、库存或随机概率。
- 一次只迁一个规则族/命令族；不一次性替换全局state、历史或UI。

## SP-02 存储迁移协议

1. 先评估 Electron 事务数据库与 HTML IndexedDB adapter；SQLite是候选建议，不是已选技术，不得直接引入native依赖。
2. importer读取旧 envelope、旧镜像键、撤销、归档、两个音频DB和壁纸DB，保存原始内容/hash/origin/schema并输出dry-run冲突清单。
3. 用户使用隔离profile的独立目标事务库导入；校验组数、总积分、成员、库存、回合、撤销数、档案数、每音频记录数/长度/hash；重启再读回。
4. 迁移标记只在所有校验通过后写；失败回滚新库，原键/DB不改。断电后以migration receipt幂等续做。
5. 每次真实迁移前导出课堂JSON、封神榜完整档案/CSV、音频BIN、题库、图标；迁移完成后仍保留源直到用户批准清理。
6. 先实现只读导入，再短期 write adapter；禁止两个权威源长期双写。每个域独立切换与回退。
7. 新实体建议包括Teacher、Classroom、Student、membership、TeacherGrouping、Group、Season、ClassSession、Round、ScoreLedger、ItemInventory/Effect、Achievement、Resource、ArchiveSnapshot；正式 schema需另审。
8. HTML保留离线独立数据，使用同构repository port和IndexedDB adapter；不宣称HTML与Electron跨origin自动同步。

## AD 追踪

| ID | 目标/本轮行动 | 主要QA |
|---|---|---|
| AD-01 | Electron优先、HTML降级、共享规则 | QA-09/14 |
| AD-02 | 单一command、集中状态写入、事务撤销 | QA-01/04/05/15 |
| AD-03 | 按业务领域分模块 | QA-02/06/12 |
| AD-04 | 教室共享名册、教师独立分组 | QA-06/07 |
| AD-05 | 赛季积分/库存与课堂统计/归档分开 | QA-04/05 |
| AD-06 | 临时状态跨课堂策略由教师设置 | QA-03/04 |
| AD-07 | 分类默认+单状态/道具覆盖 | QA-03/15 |
| AD-08 | 赛季/永久成就；60项规则见achievement-spec.md，代码未实现 | QA-05 |
| AD-09 | 组荣誉与学生个人荣誉分离 | QA-07 |
| AD-10 | 个人荣誉只从可归属行为产生，不平摊组分 | QA-07 |
| AD-11 | 教室公共资源与教师私有资源 | QA-11/18 |
| AD-12 | 公共作者编辑/删除，其他人复制独立修改 | QA-11 |
| AD-13 | 公开插件SDK和权限控制 | QA-12/18 |
| AD-14 | 插件全局安装，按用户/学科工作空间启用 | QA-12/13 |
| AD-15 | 插件只经受控API读、订阅、提交命令 | QA-12 |
| AD-16 | 组合工作空间、可调面板、保存布局 | QA-13 |

## FR 追踪

| ID | 所属域/计划阶段 | 验收 |
|---|---|---|
| FR-01 多教师/首页切换/学科 | Identity，SP-03 | QA-06/09/13 |
| FR-02 名单导入、学生与分组分离 | Roster，SP-03 | QA-06/07/18 |
| FR-03 每4–8回合随机事件 | Events，SP-04；事件池规则待定 | QA-03/15 |
| FR-04 教室共享学生名册 | Classroom/Roster，SP-03 | QA-06/07 |
| FR-05 学生/小组头像 | Resource，SP-06 | QA-11/18 |
| FR-06 课程表/切换课堂 | Classroom，SP-03 | QA-04/06 |
| FR-07 AI问答和既有API | AI，SP-08；密钥/隐私待定 | 安全审查 |
| FR-08 底栏播放/停止/下一题 | Competition UI，SP-05 | QA-08/10 |
| FR-09 下课统计结算 | Session settlement，SP-03/04；口径待定 | QA-04 |
| FR-10 七种状态 | Items/Effects，SP-04；细则待定 | QA-03 |
| FR-11 四个新增道具效果 | Item domain，SP-04；数值规则待定 | QA-02/03/15 |
| FR-12 图鉴动画/效果演示 | Item presentation，SP-05 | QA-02/10 |
| FR-13 道具升级动画 | Item presentation，SP-05 | QA-10 |
| FR-14 档案/成就UI | Archive/Achievement，SP-05 | QA-05/10 |
| FR-15 首页按最高分变化 | Welcome/Theme，SP-05 | QA-10/17 |
| FR-16 六段分数音乐 | Audio，SP-05；0/负数档位待定 | QA-17 |
| FR-17 删除壁纸功能 | Storage/Theme，SP-02后；存量图像需处置 | QA-01/18 |
| FR-18 比赛页留白优化 | Competition UI，SP-05 | QA-08 |
| FR-19 积分变化视觉 | Event→Presentation，SP-01/05 | QA-10/15 |
| FR-20 教学资源/学科空间/插件 | Resource/Workspace/Plugin，SP-06/07 | QA-11/12/13/18 |

## QA 追踪

| ID | 验收任务 | 预期方法/当前V3状态 |
|---|---|---|
| QA-01 | 旧存档迁移，积分/库存/历史/设置/音频不丢 | 隔离profile+故障注入；V3未实现 |
| QA-02 | 26道具语义及联动 | seeded differential+oracle+Chromium；历史结果有记录，新效果待规格 |
| QA-03 | 七种状态触发/时机/概率/叠加/撤销 | 注入RNG/clock；规则裁定后 |
| QA-04 | 下课结算不清零赛季分/库存 | command/事务故障注入 |
| QA-05 | 封神榜先存档再新赛季，永久信息留存幂等 | 重复请求、崩溃恢复、hash核对 |
| QA-06 | 两教师共享名册但课堂数据隔离 | 双Teacher隔离集成测试 |
| QA-07 | 改名/重名/稳定ID/个人荣誉归属 | rename/import/conflict fixtures |
| QA-08 | 垫片+14组完整，底部无多余留白 | Chromium 1920×1080 1x；现有仅合成基线 |
| QA-09 | Electron点名、全屏特效、多用户恢复 | Electron真实窗口；Windows真机仍待 |
| QA-10 | 首页动画、巡航、排名、明暗/缩放 | Chromium 1920×1080 1x |
| QA-11 | 资源公共/私有权限及复制 | 两教师权限集成测试 |
| QA-12 | 插件无授权拒绝，崩溃隔离 | sandbox/权限负测试 |
| QA-13 | 插件后台及用户切换撤销授权 | lifecycle + Electron |
| QA-14 | HTML能力降级提示、旧业务一致 | 离线文件/Chromium；管理策略BLOCKED单列 |
| QA-15 | 随机重放、账本、撤销不破坏后续变更 | seed replay + command undo |
| QA-16 | 主题预览/恢复及字体缩放100/130/160/200% | 与浏览器缩放分开验收 |
| QA-17 | 六段音乐边界 | 区间单测+真实试听；0/负数待定 |
| QA-18 | 损坏/超大/非法路径导入和插件包 | 隔离文件夹、ZIP traversal与配额fixture |

## 实施中保留的产品规则决定

1. 60项成就中“有效赛季至少4组、完成5轮”是否作为正式颁发门槛；决定前不实现封神荣誉授予规则。
2. 并列冠军仅用于荣誉还是也改变现有档案排名；决定前保留既有排名。
3. AD-10学生个人荣誉与小组60项成就采用并行还是分阶段；个人荣誉不平摊小组分数。
4. 七种新状态、四个新道具、随机事件和音乐0/负分区间缺少数值/边界；不改变现有业务规则。
5. 多教师名册冲突、壁纸现存二进制处置、AI密钥与隐私策略需要明确；隔离原型可继续，但不自动处理现有数据或外发名单。

这些问题只阻塞依赖它们的具体规则和数据处置。其他模块继续按计划实施，不能以本表作为暂停理由。

## 2026-10-19 已提交的基础迁移

HTML提交449f2c1：领域/应用/基础设施分层、Schema2安全复制与恢复、音频安全迁移、SHA-256完整来源预检、事务仓库原型及160项单元集成。核心浏览器117/117、448抽取种子、26道具oracle通过。新事务库尚未成为默认权威；接下来先做异步命令与迁移协调，不提前实现成就运行时。

Electron已同步该提交，HTML SHA-256 c466552cbe587a277b79838970935d331074173513f85d767b0e044f1de6b209，7937655字节。Electron20项单元测试及16个桌面场景通过。阶段证据见artifacts/v3-migration。

3.0.3：异步命令服务已验证actor/scope/revision、可信handler、在途/持久化意图去重、取消与提交后表现隔离；迁移协调已验证目标完整hash、确定性重试与设置点击。下一步迁出真实旧规则/命令，先治理五处legacyJudgeRound写入；还不能默认切换存储。


## 3.0.4 architecture checkpoint

Synced HTML e714dbe3c665f46431ffbc9fa7d8c537f9493dfe; SHA-256 d76c5eba28101da45c5c8af1470a8ebca5ea89a0522a7f1a66bc3e6850361d7c. Explicit round pipeline replaces four overrides without changing competition rules. Electron Node20/20 and Linux desktop16/16 PASS;1920×1080 1x14group fit and single score owner verified. Evidence artifacts/v3-round/results.json and screenshots. Runtime emitted Linux DBus/GPU diagnostics; application errors array empty. Windows native NOT TESTED. Default storage remains legacy authority; achievement runtime not yet enabled. New competition rules ZIP is intentionally deferred to the rules stage.


## 3.0.7 domain and migration journal checkpoint

Synced source eab8c7caf1c5dc86056fa8f8b15151064cf3a1e1;SHA25621611c7997b972e90b845cc33fa915b3e8b2f189758e93caa95a28c56ad53579;7940476bytes. Includes verified item override-chain removal14→1, pure ranking/injected target policy and persistent migration verification journals. Electron Node20/20 and Linux desktop16/16 PASS,1920×1080 1x14group fit and original IPC/window/score authority preserved. Evidenceartifacts/v3-domain-journal. Runtime Linux DBus/GPU diagnostics remain; application errors=[]. WindowsnativeNOT TESTED. No default storage cutover or achievement activation yet. New competition rules deferred to rule stage.


## 3.0.9 actual scoring/answer command checkpoint

Sourcecf3ebc8fae2a230fcd16d786cc294e658b327582;SHA25696299af93c3d84ff027bd7eabd5eb734a751bf6f16768debd5c43bade4bfe83d;7942522bytes. Manual scoring/direct editing,answer selection andAllInnowshare the verified legacy command lifecycle. Undo semantics,26items,14groupgeometry andone native score owner remain. ElectronNode20/20,desktop16/16PASS at1920×1080 1x, errors=[];LinuxDBus/GPU diagnostics recorded. Evidenceartifacts/v3-commands. WindowsnativeNOT TESTED. Async repository default cutover is still pending;no achievement-runtime completion claimed.


## 3.0.11 async ACK and defense ownership checkpoint

Synced HTML7440eef67a5dfab0ee5abae2f01d013eb440ed14;SHA256a3466b2811464c9a57ea22b8adc4621d1592f959beadc029947f7824a4a34a55;7945038bytes. Includes pure defense policy,GP-010pending request ownership fix and async command acknowledgments. ElectronNode20/20 andLinuxdesktop16/16PASS at1920×1080 1x,14groupfit,one score owner and secure independent windows retained, errors=[]. LinuxDBus/GPU diagnostics logged;WindowsnativeNOT TESTED. Evidenceartifacts/v3-async-lifecycle. Production storage remains legacy authority;async repository cutover still requires remaining mutation boundaries.

## 3.0.12 destructive-write barrier checkpoint

Synced HTML 3b3d7bc777aa3fadf3a5c291cec99be9932510e2; SHA256 aeb9fc54dade8a4fddfc9e58cfa4a070cabbe4cd9c448128466dc2591085f49b, 7,948,166 bytes. History clear now persists after fresh confirmation and rolls back on save failure. Destructive entry points reject in-flight durable commits. Node 20/20 and Linux desktop 16/16 PASS at 1920×1080 1x, including 14-group fit. Evidence: artifacts/v3-write-barrier. Linux DBus/GPU diagnostics remain; application errors empty. Windows native NOT TESTED. Default storage cutover remains pending.

## 3.0.13 history command checkpoint

Source 39e451430bf14fbba4d44ed4bac51eebebaa2fcc; SHA256 d8ee1fb85033e3db035f69a95f2a34f84ff3d6b92748a2aada8e30c964ff4e08, 7,949,374 bytes. History restore/undo/revert now have one command owner and one primary save; stale defense cancellation no longer restores discarded history. Electron Node20/20 and Linux desktop16/16 PASS at1920×1080 1x,14-group fit, errors=[]. Evidence artifacts/v3-history. LinuxDBus/GPU diagnostics remain; Windowsnative NOT TESTED. Production default storage unchanged.

## 3.0.14 correct-answer persistence checkpoint

Synced HTML 2afe165; package/bundle SHA and source commit verified by sync:html. Electron Node20/20 and Linux desktop16/16 PASS at 1920×1080 1x with14-group fit, no renderer errors. Evidence artifacts/v3-round-controls. DBus/GPU environment diagnostics logged; Windows native NOT TESTED. Rules ZIP and default storage switch remain pending.

## 3.0.15 guarded force-end checkpoint

Synced HTML 9804af5. Source SHA/bundle integrity validated; Electron unit20/20 and desktop16/16 PASS at1920×1080 1x,14-group fit, renderer errors empty. Evidence artifacts/v3-force-end. Linux DBus/GPU diagnostics remain in the log; Windows native NOT TESTED. No default backend cutover.

## 3.0.16 stale next-round asynchronous completion

Synced HTML 2189574. Electron bundle integrity/source SHA verified; unit20/20 and desktop16/16 PASS,1920×1080 1x14-group geometry retained, renderer errors=[]; native process logs include environment GPU/DBus diagnostics. Windows native NOT TESTED. Evidence artifacts/v3-next-round. Next-round reset itself is now being moved under one command in the following HTML checkpoint.

## 3.0.18 new-round transactional initialization

Synced HTML 2d96e4b. Electron source/package/bundle integrity validated. Node20/20 and Linux desktop16/16 PASS at1920×1080 1x; 14 groups fit, renderer errors empty. Evidence in source phase artifacts/v3-start-command and Electron desktop archive. Linux DBus/GPU diagnostics recorded; Windows native NOT TESTED. Source audio manager remains legacy and awaits lifecycle integration.

3.0.18 Electron evidence final: source `2d96e4b` verified through sync:html; unit20/20, desktop16/16 PASS, 14-group fit at1920×1080 1x, renderer errors empty. Linux DBus/GPU messages remain environmental diagnostics; Windows-native execution NOT TESTED. Evidence `artifacts/v3-start-command`.

## 3.0.19 immutable archive retries

Synced HTML cd23c47. Bundle/source hash validated; Electron Node20/20 and Linux desktop16/16 PASS at1920×1080 1x,14 groups fit, renderer errors=[]; DBus/GPU diagnostics are logged. Evidence artifacts/v3-archive-immutability. Windows native NOT TESTED.

## 3.0.20 batch answer synchronization

Synced HTML source commit `f857173d8ea9b90bcacd84851a63c3eb15d59374`; SHA-256 `af148d07e942a1e416f6fbf916a7889eb8318ca64259d648827399d89bb4722c`, 7,955,065 bytes. Electron package/source bundle integrity verified. Node 20/20 and Linux desktop 16/16 PASS; desktop viewport 1920×1080 at 1x, all 14 group cards fit, application renderer errors empty. Windows x64 unpacked executable and ZIP built; ZIP checksum test PASS. Linux emits DBus/GPU environment diagnostics. Windows native execution remains NOT TESTED (`wine` is not installed in the current environment). Evidence: `artifacts/v3-electron-320`; ZIP SHA-256 `806506a39256afca296ddac9b3265bd10de45fdbb537373fbe880a12a826a6f2`. Build did not touch CircleCI or publish externally.

## 3.0.21 transactional round settlement sync

Synced HTML source commit `7353143b9638379213eb53d3c04f3c762d30fdc9`; SHA-256 `ba45611d2da1d9e0ae1efb75adc0b1ef0c8de7dce7b894a58adf1d0619b6ee2d`, 7,955,756 bytes. Electron source/package/bundle integrity verified. Node20/20 and Linux desktop16/16 PASS; 1920×1080 1x,14-group fit, application errors=[]. Windows x64 executable and ZIP built; ZIP passes archive integrity (`c003054d74e79e083c132b2a9c39ef63bcc5c8269438d2d4c83b4a48e32850e1`). Windows native launch NOT TESTED because Wine is unavailable. Linux DBus/GPU messages are environment diagnostics. Evidence `artifacts/v3-electron-321`. No CircleCI operation or external publication.

## 3.0.22 stale Power feedback synchronization

Synced HTML source commit `90deeae9f8fa9b15a2a271067bbda14ddc18c2cb`; SHA-256 `cfff1e6ad134ed40cc6bf351c98d9036cfb9ebf52b26f35f7b09814dad315c00`, 7,955,914 bytes. Bundle integrity verified. Electron Node20/20 and desktop16/16 PASS at1920×1080 1x; 14 groups fit and application errors=[]. Windows x64 app ZIP built and archive test PASS; SHA-256 `8a2f4e0c138d4620294e1b67a5956e8e32661d0651fa477f7f816dc59a72a7f5`. Windows native launch NOT TESTED because current image has no Wine. Linux DBus/GPU diagnostics remain environmental. Evidence `artifacts/v3-electron-322`.

## 3.0.23 achievement ledger foundation synchronization

Synced HTML commit `b7d26a340cc7282a9feb5c3cd8ae67c09cefbbc0`; embedded HTML SHA-256 `b5cbfd2815fc40158e411181c36c07da56fb049b66488f3ac40cc7b6d5c3574e`, 7,963,057 bytes. Electron unit20/20 and desktop16/16 PASS; Chromium viewport1920×1080 1x, all14 groups fit, renderer errors=[]; achievement ledger remains infrastructure only (no unlock rules/UI). Windows x64 directory/ZIP cross-build completed; ZIP integrity test PASS (19 files, 345,025,539 uncompressed bytes), SHA-256 `08610fe9a9277d9619be3fe19ceb03f24e6a9c38883fe2b188f0694ec3022796`. Windows native launch NOT TESTED: Wine unavailable. Linux DBus/GPU diagnostics and renderer teardown messages were emitted by Electron during test shutdown; all 16 asserted desktop scenarios PASS. Evidence: `artifacts/v3-electron-323`. No CircleCI or external publishing.
