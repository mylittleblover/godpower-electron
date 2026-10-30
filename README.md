# 上帝的力量 Electron 3.0.57（无插件过渡版）

离线课堂竞技程序。一个主窗口保留全部比赛、道具、历史和存档；独立点名悬浮窗和透明全屏揭晓窗共用主窗口的抽选结果。

Windows测试包：[Google Drive 3.0.57](https://drive.google.com/drive/folders/1FCk8AGKSuN27EEaFnuPp4E9EMwYQAoG5)。下载两个分卷和Merge-and-extract-3.0.57.cmd到同一目录，双击脚本校验并解压，再运行exe。Windows实体触屏与系统屏幕键盘仍需真机复验。

## 使用

- 菜单「课堂 → 打开点名悬浮窗」，或全局快捷键 **Ctrl+Shift+P**。
- 拖动悬浮窗标题栏移动，拖动边缘缩放；置顶、跨屏演出和目标显示器在悬浮窗底部展开设置。
- 支持全班学生、小组、先组后人；奖池、预选组和防重复沿用主课堂实际规则。历史、六个赋分槽位、自定义正负分实时同步。
- 拉动右侧拉杆开始/停止。停止后约一秒减速，随后在指定屏幕独立揭晓。Escape、演出右下角按钮或悬浮窗「跳过演出」可结束。主窗口负责原有音效及自定义音频，辅助窗不重复播放。
- 关闭悬浮窗不停止主窗口抽选。关闭主窗口会隐藏并保留后台课堂。刷新或恢复崩溃后，未确认的抽选不会重抽，已经保存的课堂数据继续读取。

## 开发与验证

```bash
npm ci
npm start
npm test
npm run test:smoke
npm run test:desktop
npm run verify:bundle
npm run build:win:cross
```

桌面验收固定 **1920×1080、1x**。test:desktop 使用临时 userData 目录；包含故障注入、真实三窗口、截图和 14 小组布局检查。Linux 无显示服务时用 Electron 的 headless 平台；测试命令的 `--no-sandbox` 只用于本容器测试启动，正式程序不添加此开关，所有窗口 webPreferences.sandbox 始终为 true。

`npm run build:win` 在 Windows 生成 NSIS 安装器和 portable 版本。本次Linux环境不具备Windows真机测试能力，发行使用交叉构建x64 ZIP；Windows运行另行标记。完整解压后双击其中「上帝的力量.exe」，不能只复制 exe 一个文件。

Windows 原生可执行测试（当前环境 **NOT TESTED**）：

```powershell
npm ci
$env:GODPOWER_WINDOWS_EXE=(Resolve-Path '.\release\win-unpacked\上帝的力量.exe')
npm run test:windows
```

此测试通过 Playwright 启动真实 exe，使用隔离档案，覆盖三种模式、独立演出、赋分与 preload 权限，输出 artifacts/windows-native。PPT 覆盖、多显示器硬件、拖动和听感仍需按验收报告人工检查。

## 同步 HTML 源码

默认路径为兄弟仓库 `../godpower-html/dist/godpower.html`。源 checkout 必须干净，先在 HTML 仓库构建、测试、提交；同步会重新构建并与已提交 dist 做逐字节比较。

```bash
npm run sync:html
# 使用其他明确的 checkout：
GODPOWER_HTML_SOURCE=/absolute/checkout/dist/godpower.html npm run sync:html
```

resources/BUILD_INFO.json 记录源码仓库、提交 SHA、HTML SHA-256 和字节数。启动和 Windows 打包前都会核验。不得直接编辑 resources/index.html。无需网络、CDN 或开发服务器，HTML 仓库继续发布独立单文件。

详见 [架构](docs/ARCHITECTURE.md)、[验收矩阵](docs/TEST_MATRIX.md)、[3.0.0 版本说明](docs/reports/ACCEPTANCE_3.0.0.md)、[0.2.0 历史验收报告](docs/reports/ACCEPTANCE_0.2.0.md)、[维护列表](docs/MAINTENANCE_BACKLOG.md)。

### 悬浮图标与后台运行

启动后右侧显示可拖动的点名图标。点击展开，面板标题栏的收起按钮回到图标；再次打开会恢复面板尺寸。关闭主窗口只隐藏主课堂，点名继续使用同一份课堂状态。通过系统托盘“显示主窗口”恢复，通过“彻底退出”结束程序。

音效与音乐设置的“全屏演出”包含点名揭晓、加分、扣分三个独立槽位，可追加多个候选音效并随机播放。V3.0.57普通功能窗口统一回到主程序内部，只有点名悬浮窗及全屏演出保持独立。已移除普通弹窗的DOM克隆/远程输入回放，输入框不会再因快照更新被替换。图标拖动直接使用鼠标/触屏Pointer Events；展开位置跟随图标，靠近边缘时自动避让。编辑输入框时暂不因失焦收起，避免屏幕键盘取焦导致面板消失。


### 3.0.0 道具积木与内容更新

设置中的“道具与图标”提供26道具的抽取/操作独立配置；“欢迎页内容管理”提供知识/挑战的表单编辑、JSON文件导入导出。首页知识点可下一轮，挑战答对后可下一题。详见[本次验收](docs/reports/ITEM_MODULES_3.0.0.md)。

Drive分段发行：构建后运行 `npm run prepare:drive`，上传 `release/drive/3.0.0` 内的两段文件与合并脚本；用户下载到同一目录运行脚本，校验成功后解压。
