# V3 SP-00 / SP-01 / SP-02 实施计划（待用户批准）

本计划按交接包限定为计划，不是编码授权。本轮只做文档审计；获批后另开分支和隔离工作树。UI沿用用户最近指定的 Chromium、1920×1080、1x。Windows原生、存储故障注入仍需按专项验收，不能以截图替代。

## 阶段和提交边界

| 子项目 | 目标与变更边界 | 主要验收/退出条件 | 回滚 |
|---|---|---|---|
| SP-00 | 冻结现状、功能/数据/行为和历史测试证据；仅文档/合成夹具 | 26道具、五页、点名、撤销、结算、14组和存储映射齐备；PASS与旧报告重跑区分 | 回退文档提交，无用户数据影响 |
| SP-01a | 定义稳定领域 DTO、命令/事件 contract、ports；仅新增纯模块 | contract测试通过、旧业务行为不变 | 删除独立新模块 |
| SP-01b | 逐项提取 ranking/score、defense、draw、operation 纯规则；旧代码仍保留 | 464 item-defense differential、448 seeded draw、26 oracle、14组基线不退化 | 每规则族一个提交，旧实现可切回 |
| SP-01c | 用旧 state adapter 把单一命令族接入统一 command/transaction | 保存失败、异步防御、撤销/恢复、重复请求/导入均原子一致 | feature flag/旧入口保留，逐类回退 |
| SP-02a | 存储后端 spike 与 schema ADR；不迁真实用户数据 | 事务、崩溃恢复、跨平台构建、备份恢复、离线、依赖 ABI 对照，用户选定方案 | 丢弃隔离原型 |
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

## 等待评审的事项

1. 确认V3总规格及本实施计划为正式需求基线。
2. 60项成就里“有效赛季4组、5次答题”是否为正式门槛；并列冠军是否也决定档案排名。
3. AD-10学生个人荣誉与小组60项成就是并行还是分阶段。
4. 未决竞技规则是否保持推迟，不进入SP-01/02。
5. 批准先做隔离存储spike，但不迁真实用户数据、不换默认数据源。
6. 明确壁纸存量的导出/保留/删除方式。

**停止点：**审计和计划文档已准备。SP-01/02 尚未实施；待计划批准后再建立新分支，从基线工作开始。
