# SP03 插件平台设计审阅入口

日期：2026-10-20。状态：设计已获用户批准；后续授权已开始分阶段实施。当前Electron版本3.0.25。M0/M1源端实现已提交，详情见本文件末尾的执行续记。

## 权威设计源

共享协议与设计只在HTML源码仓维护，Electron不复制另一套规格：

- 仓库：mylittleblover/godpower-html
- 分支：feat/v3-foundation-sp01-sp02
- 设计提交：50db4a8a63cb9d5d164ffee5a56e454c4e282a1f
- [总规格与源码审计](https://github.com/mylittleblover/godpower-html/blob/50db4a8a63cb9d5d164ffee5a56e454c4e282a1f/docs/superpowers/specs/2026-10-20-godpower-v3-plugin-platform-design.md)
- [运行环境/权限/生命周期/SDK](https://github.com/mylittleblover/godpower-html/blob/50db4a8a63cb9d5d164ffee5a56e454c4e282a1f/docs/superpowers/specs/SP03-A-plugin-runtime-design.md)
- [UI贡献/主页工作区/插件中心](https://github.com/mylittleblover/godpower-html/blob/50db4a8a63cb9d5d164ffee5a56e454c4e282a1f/docs/superpowers/specs/SP03-B-ui-contribution-design.md)
- [竞技迁移/数据/兼容闸门](https://github.com/mylittleblover/godpower-html/blob/50db4a8a63cb9d5d164ffee5a56e454c4e282a1f/docs/superpowers/specs/SP03-C-gameplay-migration-design.md)
- [主题/文案/页面展示](https://github.com/mylittleblover/godpower-html/blob/50db4a8a63cb9d5d164ffee5a56e454c4e282a1f/docs/superpowers/specs/SP03-D-theme-text-view-design.md)
- [11款学科插件范围](https://github.com/mylittleblover/godpower-html/blob/50db4a8a63cb9d5d164ffee5a56e454c4e282a1f/docs/superpowers/specs/SP03-E-official-subject-plugins-design.md)

## Electron边界

当前基线10c6cfc42b553666b47eb016afa88d452ebe55a7，HTML基线6dcc2be99ea8d55864deb57e738de14a517a04fb。现有安全preload、classroom://app origin、userData、唯一主窗口课堂状态、悬浮点名/全屏特效、独立功能窗口均保留。

未来插件采用共享SDK及manifest；第三方脚本不进主renderer，专用沙箱宿主/独立partition/窄原生代理需单独实现并验证。当前CSP frame-src 'none'及默认权限拒绝不因设计提交改变。资源HTML未重新同步，因为源码行为没有改变；BUILD_INFO的源代码SHA仍807b63e，后续为文档提交。

## 本轮验证和下一闸门

原审阅阶段执行Electron npm test：20/20通过；npm run verify:bundle通过；HTML npm test：246/246通过。后续M1阶段结果见执行续记。

原任务单阶段门已由用户后续明确批准两套设计并授权连续实施，计划已提交。竞技规则差异仍阻塞相关规则改动，但不阻塞UI基础和插件运行框架。

## UI治理设计审阅入口

2026-10-20新增的UI治理包设计与审计位于HTML源码仓（Electron不复制另一套UI SDK）：

- HTML开发分支提交：32893708c24d8cd32e9c82d18b35be164a2cf345
- [UI治理设计规格](https://github.com/mylittleblover/godpower-html/blob/32893708c24d8cd32e9c82d18b35be164a2cf345/docs/superpowers/specs/2026-10-20-godpower-v3-ui-governance-design.md)
- [证据与全仓统计](https://github.com/mylittleblover/godpower-html/blob/32893708c24d8cd32e9c82d18b35be164a2cf345/docs/ui-audit/01-evidence-and-findings.md)
- [依赖与迁移映射](https://github.com/mylittleblover/godpower-html/blob/32893708c24d8cd32e9c82d18b35be164a2cf345/docs/ui-audit/02-dependency-and-migration-map.md)
- [UI回归矩阵](https://github.com/mylittleblover/godpower-html/blob/32893708c24d8cd32e9c82d18b35be164a2cf345/docs/ui-audit/03-regression-matrix.md)
- [风险登记](https://github.com/mylittleblover/godpower-html/blob/32893708c24d8cd32e9c82d18b35be164a2cf345/docs/ui-audit/04-risk-register.md)

UI方案明确复用SP03的唯一ContributionRegistry，比赛14组基线和Electron现有CSP/IPC不放宽。原审阅时没有修改产品代码；M0/M1阶段完成度与真实验收见下方执行续记。

## 执行续记：M0–M1（2026-10-20）

- HTML计划提交 `1b95aae`；M0资产所有权与浏览器基线提交 `fd57f6a`；M1唯一ContributionRegistry与core routes提交 `e0dc04e`。源仓库均在 `feat/v3-foundation-sp01-sp02`，已推送。
- Electron随HTML提交同步版本3.0.25。`resources/BUILD_INFO.json`记录HTML源Commit `e0dc04ec4bda5b63927ae5e0a69d32f4e1453900`、SHA-256 `abc4f60b9b308c38fb95f78903ce8c71538947c8954823a36d791187a85fcd27`、7,981,868 bytes。
- Electron实际测试：`npm test` 20/20 PASS；`npm run test:smoke` PASS；`DESKTOP_ARTIFACTS=/tmp/godpower-electron-m1 npm run test:desktop` 16/16场景PASS；`npm run verify:bundle` PASS。Headless运行日志有DBus/GPU以及测试退出时的hung-child诊断文本，结果JSON `status=PASS`、`errors=[]`。Windows原生安装包/真机NOT TESTED，未运行CircleCI。
- Electron同步只更新配套版本与HTML资源，没有放宽CSP/preload/IPC权限，也没有改主窗口业务。

## 执行续记：M2 页面生命周期与 Electron 同步（2026-10-20）

- HTML M2提交 `42789c19f0c827d40cc9fe17c8b5c367a09b47e4`；v3.0.26，页面`DisposableScope`与scope绑定入场动画。详情：HTML仓 `docs/ui-audit/M2-page-lifecycle.md`、`docs/TEST_MATRIX.md`。
- HTML验证：`npm test` 257/257；页面生命周期E2E、贡献注册E2E、桌面UI 23/23、五页截图/14组布局均PASS，统一为Chromium 1920×1080 1x。
- Electron v3.0.26 已从上述干净提交同步，单文件7,987,373 bytes，SHA-256 `3ce8cfb9c8bcf07ebf7cf442152627ddcfb68db39bba935d596cc16426204f56`；详情见 `docs/validation/v3.0.26-electron-sync.md`。
- Electron验证：`npm test` 20/20、`test:smoke`、`test:desktop` 16/16及`verify:bundle` PASS。CircleCI未运行；Windows NOT TESTED。

## 执行续记：M3 声明式插件中心（2026-10-20）

- HTML v3.0.27已提交 `8ceef67a253b117f017571780e19237551193f54` 并推送。六个core routes新增「插件」入口；提供manifest校验、权限审阅、启停、受限插件页workspace、scope私有数据与卸载留存。插件当前只接受声明式JSON，不执行第三方JavaScript。
- 验证：build/check/format通过；unit/integration 268/268；plugin Center E2E与注册/生命周期、release-smoke 4/4、Chromium 1920×1080 1x desktop-ui 23/23及14组布局均PASS。CircleCI未运行。
- Electron v3.0.27同步 commit `8ceef67`，commit与SHA记录在 `docs/validation/v3.0.27-electron-plugin-center.md`。Electron unit 20/20、smoke六页及持久化、desktop 16/16 PASS。Windows未测。
- 后续仍需PLUG-M2隔离执行沙箱、PLUG-M3签名ZIP/迁移存储、PLUG-M4管理授权UI、PLUG-M5 Electron broker，见HTML仓 `docs/MAINTENANCE_BACKLOG.md`。
