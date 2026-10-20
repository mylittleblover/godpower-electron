# SP03 插件平台设计审阅入口

日期：2026-10-20。状态：设计待用户审阅，尚未开始产品实现或实施计划。当前Electron版本保留3.0.24；本提交仅为文档。

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

实际执行Electron npm test：20/20通过；npm run verify:bundle通过；HTML npm test：246/246通过。两端HTML实际字节和SHA一致。以上仅为既有基线验证，不证明插件运行环境完成。本轮未进行浏览器/Windows真机/新插件测试，不执行CircleCI，不包含已有未跟踪截图文件。

按用户任务单第十五节，先等待六份设计规格批准，随后才调用writing-plans并交付独立实施计划；实施计划仍需批准并确定执行方式。未审竞技规则差异继续阻塞相关规则，不阻塞审阅平台设计。
