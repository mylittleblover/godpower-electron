# 存储键、数据表与迁移映射

只读基线：HTML feat/marx-theme 2ba6bedd；Electron feat/marx-theme 6fadf225。旧程序主存储仍然分散在 localStorage、两个 IndexedDB 和 Electron userData 窗口偏好；不能把当前 JSON 导出称作全应用备份。

## 课堂 localStorage

| 键/表 | 当前内容与来源 | 目标实体/处理 | 迁移风险/回滚 |
|---|---|---|---|
| godpower_state_v1 | schemaVersion=1 的主课堂 envelope；groups、picker、round、itemGlobal、history、配置等 | Classroom/TeacherGrouping/Season/Session/ItemInventory/Event archive | 新库只读导入、原文哈希与计数核对；迁移标记最后写；不覆盖原键 |
| politics_groups_data | 旧版小组镜像，主 envelope 成功后写 | Student / ClassroomStudentMembership / TeacherGrouping / Group / GroupMembership / season score | 组/成员 ID 与重复/重命名冲突；保留原文和冲突报告 |
| politics_picker_state | 旧点名模式、防重复候选池/历史等 | RollCall settings/state/session events | 学生/小组改 ID 后需映射；不重抽 |
| politics_item_global | 道具总抽取、全局状态、点名/举手统计、icon 等部分兼容镜像 | Season/item/event state + Icon asset reference | 某些 icon data URI 较大；和 envelope 镜像不一致时不可静默合并 |
| politics_history_stack_v26 | 最多40条旧操作前快照；fallback 字符串 politics_history_v26 | Event/undo journal import | 旧快照字段不完整；保留原序列、不可猜测升级 |
| politics_settlement_history | 课堂/赛季最终清零完整档案数组 | immutable ArchiveSnapshot / Season | 新表事务必须同时完成归档+状态切换；旧档案保留完整 JSON |
| politics_admin_pin | 默认1234 的本地防误触 PIN | Teacher preference + local secret handling | 不是真认证；多用户模型必须隔离 PIN/权限含义 |
| politics_master_volume、politics_sfx_volume | 主音量和音效音量 | Teacher/Audio preferences | 即时保存，值域校验 |
| politics_zoom_level | 应用缩放 | User/UI preferences | 不是课堂领域数据 |
| politics_resizer_enabled、politics_resizer_height、politics_column_mode | 垫片/组列布局 | User/Competition presentation preferences | 14组显示相关；不能在迁移时重置 |
| politics_save_allin | All In 保存设置 | Competition policy preference | 属业务偏好，字段语义/缺省保持 |
| politics_menu_audio_cfg | 菜单音乐开关/配置 | Audio preferences | 现有轨道设置不可覆盖 |
| politics_wall_veil | 用户壁纸遮罩 | Theme/Wallpaper preferences | FR-17 建议删除自定义壁纸；先明确保留现图导出/转为默认底色/删除策略 |
| politics_item_icons | 道具图标 data URI 包 | Item artwork assets | 与压缩后的图片媒体表关联，校验 MIME/大小/引用 |
| politics_ui_icons_v26 | 功能/界面 icon data URI | Theme/resource asset table | 迁移前包导出/哈希；异常图标不覆盖可用项 |
| politics_audio_migration_v1 | 旧音频 DB 迁移完成标志 | Migration journal | 不能将旧标记当作已导入新库的证据 |
| politics_communism_mode | 课堂规则/显示模式开关，与 Marx 外观主题不同 | Competition preference + appearance theme 独立 | 不混淆旧“共产主义模式”和外观主题 |
| godpower_item_modules_v1 | 每道具抽取/使用配置，26项 | Teacher/workspace item rule preferences | 非课堂快照；独立 schema 校验和导入回滚 |
| godpower_ui_preferences_v1 | 动效、内容分类、缩放等 UI 偏好 | User/workspace preferences | 不是业务状态，当前课堂 JSON 不含 |
| godpower_ui_bank_v1 | knowledge/challenges 本地题库 | TeachingResource + owner/scope | 需升级为公共/教师私有 scope；现有 JSON 导出继续可读 |
| godpower_score_feedback_v1 | 六个赋分槽、演出样式/开关和时长 | Feedback/theme preferences | 确认不影响实际赋分 |
| godpower_appearance_v1 | classic/marx 主题 | User theme preferences | 主题与旧规则开关拆开 |

以上 literal 键由当前源码搜索与 DATA_SCHEMA 合并；字符串键以外的兼容读取需后续用静态清单脚本统一校验。

## IndexedDB

| 数据库/对象仓库 | 当前结构 | V3 迁移 |
|---|---|---|
| PoliticsScoreSoundDB_Unified v1 / sounds | {id,arrayBuffer,name?}；fx_<slot>、候选音效记录、bgm_menu_* 与上传曲目 | 独立 Media asset store；保留字节、mime/name/操作槽关系；JSON classroom backup 不能替代 BIN 音频包 |
| PoliticsScoreSoundDB_v3 / PoliticsScoreSoundDB / sounds | 历史音频数据库，script/00.js migrateOldDatabases 读取并复制 | 仅作为遗留导入源，不删除、不升级原库直至验证新库所有数据和资源引用 |
| PoliticsUiDB v1 / kv | key=wallpaper 的 Blob | FR-17 删除壁纸前导出或询问确认；若迁移，媒体表按引用管理 |
| 浏览器 origin 存储 | file://、HTTP、Sites、classroom:// 各有独立 origin/配置目录 | 显示来源迁移说明；不要假定 Site/HTML/Electron 自动共享 |

## Electron userData 与传输态

| 内容 | 当前路径/结构 | V3 去向 |
|---|---|---|
| 桌面窗口状态 | userData/desktop-windows-v1.json：alwaysOnTop、effectsEnabled、displayId、pickerBounds、iconPosition；临时文件+rename | Desktop profile preferences；与课堂状态分库 |
| RollCall IPC DTO | broker/窗口内存态：epoch、client transport UUID、序号、去重和当前抽选结果 | Application command/event transport；明确 actorUserId/workspaceId/sessionId |
| 全屏展示 | 仅存在已确认 result DTO；不作为业务持久数据 | Effects presentation event；动画关闭后释放 |
| 发行 HTML | resources/index.html + BUILD_INFO.json：HTML commit、SHA-256、字节数及 tooltip assets SHA | 继续从 HTML source 同步；每次发布 verify 源码/提交/哈希 |

## 建议迁移协议（待设计批准）

1. 只从隔离的测试 profile 构建 fixture；生产用户要在实际迁移前单独导出课堂 JSON、档案 CSV/JSON、音频 BIN、图标/题库。禁止触碰用户真实 localStorage 或 appData。
2. 导入器读取每个已知旧键/DB，保存原始字节或原始 JSON、key 名、源 origin、schema/version、SHA-256；先产生 dry-run 冲突报告。
3. 以幂等 migrationId 导入事务库，检查记录计数、总积分、每组库存/成员、档案条数、音频 ID 和 SHA/长度；任一失败就回滚新库事务，原键/库不删不覆盖。
4. 完成后写入新 schema import receipt。迁移标记须在所有验证之后；不通过时应用只读旧数据或提供恢复包，不静默开空课堂。
5. 首阶段可先读旧格式到新模型并保留旧写路径；双写仅作为短期过渡，需检测每次写差异并设移除条件，不能长期两个权威源。
6. 用户批准后分批切换读/写 owner；每一阶段可切回旧程序读取仍保留的旧副本。验证一定期限后另行提供清理按钮；不能在本轮/自动更新里删除旧键。

## 存储决策待审

Electron 多教师、关系数据和封神榜原子事务需要有可靠事务的存储。推荐评估 Electron SQLite 事务后端作为桌面权威库，HTML 使用 IndexedDB adapter 作降级/导入导出；当前尚未选库或确认原生 addon 构建、迁移、加密、备份和 Win/Linux/macOS 发行影响。必须先小型 spike，不能凭“SQLite 更适合”直接加 native dependency。备选为 IndexedDB 跨平台，但其同步 API 和跨对象库存/档案原子性约束需单独证明。

需要决定：

- 成就与领域事件是否在同一事务表；推荐是。
- 音频资源是否由媒体库独立管理、DB迁移失败时如何导出。
- classroom local file/HTML 的数据被 Electron 如何显式导入，而非跨 origin 直接共享。
- SQLite native module 是否跨平台构建；userData 主文件与 WAL 一致性。
- 旧用户多来源/重复教师数据如何冲突解决，不能按名称自动合并。
