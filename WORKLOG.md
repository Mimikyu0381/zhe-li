# 网站改版工作留存（Figma 改版）

## 目标
- 按 Figma 最新设计改造 `D:\My_website`。
- 电脑端、移动端拆分到独立目录与独立样式文件。
- 保留现有页面内容、Three.js 3D 校园与 Leaflet 地图功能。

## Figma 基准
- 文件：`EP69z38QPNguDxYT35bf7K / Untitled`
- 链接：https://www.figma.com/design/EP69z38QPNguDxYT35bf7K/Untitled?node-id=0-1
- 画板分组（同组内为桌面/移动导入）：
  - `2:290`：桌面 `2:13` / 移动 `2:294`，首页 `index.html`，已确认
  - `21:163`：桌面 `21:6` / 移动 `21:169`，红色地图 `resources.html`，已确认
  - `23:178`：桌面 `23:2` / 移动 `23:185`，遗址分布 `map3d.html`，已确认
  - `23:846`：桌面 `23:363` / 移动 `23:854`，革命历程 `achievements.html`，已确认
  - `23:2346`：桌面 `23:2279` / 移动 `23:2355`，关于我们 `about.html`，已确认
- 截图与 CSS 留存目录：`C:\Users\Zekrom\.codex\visualizations\2026\10\23\01a16641-7b3b-72d2-9011-06911f29cb7e`
- 注意：Figma 画布无法直接抓取 DOM CSS；颜色、字号、间距、圆角与阴影须从 Design/Dev Mode 或 Copy as CSS 读取，不得臆造。

## 已确认视觉特征
- Figma 内容实际是 `mimikyu0381.github.io` 的 html.to.design 导入，视觉与现有旧站一致：白底、红色页头、米白内容区。
- 桌面“关于我们”画板尺寸 `1440 x 1342.14px`，页面底色 `#FFFFFF`。
- 内页横幅：`linear-gradient(98.83deg, #5F1115 0%, #9A1D22 100%)`，`padding: 63px 120px 56px`。
- 页面标题：Microsoft YaHei，36px/65px，700，白色，字距 4px；副标题 16px/29px，字距 1px。
- 二级标题：28px/50px，700，`#7A1515`，字距 3px；装饰线 64 x 3px，`#E8B64C` 到 `#C0272D`。
- 内容框：`#FBF3E7` 背景、`2px dashed #D9CBB9`、10px 圆角、`#9A8C7A` 文字。
- 卡片：白底、`1px solid #E8E0D4`、10px 圆角、`0 4px 4px rgba(0,0,0,.25)` 阴影。
- 页面需要按 1440px 与 390px 两个基准分别验收。

## 工作清单
- [x] 建立工作留存文件
- [x] 确认 Figma 内容与现有站点同源，记录“关于我们”精确 CSS
- [x] 展开并盘点桌面画板子层与页面
- [x] 展开并盘点移动画板子层与页面
- [x] 记录五页映射与基准尺寸
- [x] 阅读现有 HTML、CSS、JS 的页面结构与交互依赖
- [x] 创建 `desktop/` 与 `mobile/` 两套页面（各 5 个 HTML，资源路径已校正）
- [x] 编写两套独立 CSS，并复用现有 JS、图片与 Leaflet 资源
- [x] 本地启动并验证五个页面在 1440px/390px 下的布局（连通性与静态校验完成；像素截图受浏览器策略限制）
- [ ] 修正导航、链接、3D 地图与响应式问题
- [ ] 完成最终对照检查与交付说明

## 进度记录
- 2026-10-23：已读取桌面首屏截图；确认 Figma 为 canvas，需通过设计面板提取精确参数。尚未修改站点文件。
- 2026-10-23：修正先前错误判断，确认 Figma 是旧站快照而非新配色；已取得桌面“关于我们”全部图层 CSS（`about-desktop-all-layers.css`）。
- 2026-10-23：下一步逐组打开画板截图，完成五页映射后开始目录拆分。
- 2026-10-23：五页映射全部确认。新增提取 `unknown-2-13.css`、`unknown-21-6.css`、`unknown-23-2.css`（桌面 CSS），以及 `index-mobile-all-layers.css`（390px 移动端 CSS）。当时尚未创建目录，也未修改站点文件。
- 2026-10-23：补充本轮确认的精确基准：桌面 Header 约 77px；首页 Hero 约 400.59px；内页 Banner 约 223.6px；主区纵向 gap 55px、底部 padding-bottom 56px；页脚 112px、背景 #9A1D22。移动端 Header 约 184px；首页 Hero 约 439.9px；内容宽约 350px；时间线、卡片单列；地图上下布局。
- 2026-10-23：目录与页面拆分完成。`desktop/`、`mobile/` 各含 `index.html`、`resources.html`、`map3d.html`、`achievements.html`、`about.html`；CSS 统一指向各自目录的 `style.css`，图片指向 `../images/`，Leaflet 指向 `../css/` 与 `../js/`。根目录原页面尚未覆盖。
- 2026-10-23：当前 10 个页面已可被本地服务器访问，但两套 `style.css` 尚未创建，页面暂时无样式。下一步先写桌面端，再写移动端；每完成一批更新本日志。
- 2026-10-23：完成 `desktop/style.css`。包含 1440px Header/Hero/Banner/卡片/统计/时间线/人物/联系/页脚，以及完整 3D 漫游与 Leaflet 点位地图交互样式；HUD 指针事件规则保持不变。
- 2026-10-23：完成 `mobile/style.css`。按 390px 单列布局重写：纵向 Header、两行导航、Hero 439px 基准、单列卡片/统计/人物/联系/时间线、3D 小地图与上下排列的 Leaflet 面板。
- 2026-10-23：为 `desktop/about.html`、`mobile/about.html` 的 `<body>` 添加 `page-about` 类，仅用于页脚深红配色，不改动页面内容。
- 2026-10-23：下一步启动本地服务器，逐页检查 1440px/390px 实际渲染、中文图片路径与 3D/地图交互。
- 2026-10-23：本地服务器启动于 `http://127.0.0.1:8899/`。`desktop/` 与 `mobile/` 各 5 个页面全部返回 200；HTML 中所有本地引用均存在；中文图片、Three.js、OrbitControls、Leaflet、buildings/explore 脚本均返回 200。
- 2026-10-23：CSS 静态检查通过：两套文件括号深度为 0，变量全部有定义，HTML 出现的 80 个类名均有对应规则。补充 `.section-alt`、`.map-frame`、`.w3d-info-desc` 规则，修正移动端导航宽度与 HUD 提示换行。
- 2026-10-23：尝试用应用内浏览器做 1440/390 截图时，浏览器安全策略拒绝访问 `127.0.0.1`（本地网络未获授权），随后拒绝 `file://`。未绕过策略。可人工打开 `http://127.0.0.1:8899/desktop/index.html` 与 `http://127.0.0.1:8899/mobile/index.html` 做最终目视确认。
- 2026-10-23：新增校徽 `images/cugb-logo.png`（241×234），并放入桌面/移动“关于”页“所在院校”卡片中校名下方；新增 `.contact-logo` 样式（桌面 120px、移动 112px），联系卡片改为纵向居中。图片请求返回 200。
- 2026-10-23：桌面“遗址分布”页的“重点红色点位”改为固定五列同排（`.card-grid-five`），仅调整该组卡片的内边距与字号；移动端仍为单列。
- 2026-10-23：清理旧文件：删除根目录旧 `resources.html`、`map3d.html`、`achievements.html`、`about.html`，删除旧 `css/style.css`、未使用的 `js/vendor/three.module.js` 与 `js/vendor/OrbitControls.js`，以及无引用的 `images/001.png`、`images/002.png`。根 `index.html` 改为自动分流入口：宽度 ≤820px 进入 `mobile/`，其余进入 `desktop/`；`DEPLOY.md` 同步更新。
- 2026-10-23：移动端“红色地图”页不再加载 Three.js/OrbitControls/buildings/explore，也不初始化 WebGL；3D 区域改为居中的“请使用电脑浏览器参观”提示，并隐藏 3D 操作层与遗址切换标签。移动端说明文案同步改为“3D 遗址漫游需在电脑浏览器中使用，手机端暂不支持”。桌面端 3D 不受影响。
- 2026-10-23：根据追加需求恢复移动端 3D，并改为触控漫游：点击红色地图 →「开始浏览」后请求全屏并锁定横屏；左下固定摇杆输出 -1..1 模拟量驱动角色，画布单指滑动更新 yaw/pitch；右下新增「查看」「退出」按钮；竖屏时顶部显示“请横屏使用”。全屏 API 不可用时用 `position:fixed; 100dvh` 兜底铺满视口；退出全屏会自动结束漫游并恢复到总览视角。
- 2026-10-23：`js/explore.js` 的 `_move` 增加可选 `touchMove` 输入，键盘操作保持原行为；移动端禁用指针锁定与桌面鼠标视角监听，避免与触摸冲突。
- 2026-10-23：移动端 3D 渲染像素比上限降至 1.5，降低手机 GPU 压力；全屏失败时仍以固定定位铺满视口，退出漫游会恢复总览视角。待真机验证横屏锁定与摇杆手感。
- 2026-10-23：准备 GitHub Pages 部署。确认仓库当前无远程地址，站点总计约 6.31 MB，未超过 Pages 限制；根目录 `.nojekyll` 已存在。桌面端、移动端 `map3d.html` 的高德地图瓦片由 `http://` 改为 `https://`，避免 Pages 的 HTTPS 页面因混合内容拦截地图。恢复 `.gitignore`，避免本地调试产物被推送。`DEPLOY.md` 补充新建空仓库、首次推送、发布后检查项、`origin` 冲突处理，以及使用 Node.js 的本地预览命令。
