# 部署指南：把本站变成可访问的网站

本项目是**纯静态网站**（HTML + CSS + JS + 图片），没有任何后端代码，
所有资源引用都是相对路径，因此可以托管在任何静态托管服务上，无需买服务器。

站点按屏幕宽度分流：根目录 `index.html` 会自动进入 `desktop/` 或 `mobile/`。
部署时必须同时保留 `desktop/`、`mobile/`、`images/`、`css/`、`js/` 五个目录。

---

## 一、推荐方案对比

| 方案 | 费用 | 国内访问速度 | 自定义域名 | 备注 |
| --- | --- | --- | --- | --- |
| **GitHub Pages** | 免费 | 一般（时快时慢） | 支持，免费 HTTPS | 首选，5 分钟上线 |
| **Cloudflare Pages** | 免费 | 一般 | 支持，免费 HTTPS | 免费额度宽松，无限带宽 |
| **腾讯云 EdgeOne Pages** | 有免费额度 | 好（国内节点） | **需已备案域名** | 要走国内节点必须备案 |
| **阿里云 OSS / 腾讯云 COS** | 按量计费，约几元/月 | 好 | **需已备案域名** | 流量越大越贵 |

**结论：先免费用 GitHub Pages 上线。** 如果后续发现国内访问慢到不可接受，
再考虑买域名 + 备案 + 国内对象存储。

---

## 二、方案 A：GitHub Pages（推荐，免费）

### 1. 创建仓库并推送

先在 GitHub 网页新建一个空仓库（不要勾选自动生成 README、`.gitignore` 或 License），
仓库名可以叫 `My_website`。拿到仓库地址后，在本目录执行：

```powershell
git status
git add .
git commit -m "完成响应式页面与移动端 3D 漫游"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> 注意：GitHub Pages 对**公开仓库免费**；私有仓库要用 Pages 需要付费的 GitHub Pro。
> 把这个仓库设为 Public 即可零成本。
>
> 根目录的 `.nojekyll` 必须一起提交，否则 GitHub Pages 可能忽略以下划线开头的文件。
> 如果之前已有 `origin`，用 `git remote set-url origin <仓库地址>`，不要重复执行
> `git remote add`。

### 2. 开启 Pages

仓库页 → **Settings** → **Pages** → Build and deployment：

- **Source** 选 `Deploy from a branch`
- **Branch** 选 `main`，目录选 `/ (root)`
- 点 **Save**

等约 1 分钟，访问：

```
https://<你的用户名>.github.io/<仓库名>/
```

因为本站所有链接都是相对路径，放在 `/<仓库名>/` 子目录下也能正常工作，**无需改任何代码**。

首次发布可能需要几分钟；以后每次 `git push` 到 `main`，Pages 都会自动重新发布。
部署后依次检查：

- `https://<你的用户名>.github.io/<仓库名>/`：应自动进入电脑端或移动端
- 直接访问 `/desktop/index.html` 和 `/mobile/index.html`
- “红色地图”页的高德瓦片能正常加载（站点已统一使用 HTTPS）
- 手机端 3D 漫游的全屏、横屏、摇杆和滑动视角

如果页面出现 404，先到仓库 **Actions** 或 **Settings → Pages** 查看发布状态；
如果样式或图片 404，确认 `desktop/`、`mobile/`、`images/`、`css/`、`js/`
五个目录都已推送到仓库。

### 3. 绑定自己的域名（可选）

1. 在域名商（阿里云 / 腾讯云 / Cloudflare / Namecheap）买域名
2. 仓库 Settings → Pages → **Custom domain** 填入 `www.你的域名.com`
3. 到域名商 DNS 后台添加 CNAME 记录，指向 `<你的用户名>.github.io`
4. 勾选 **Enforce HTTPS**（GitHub 提供免费证书）

---

## 三、方案 B：Cloudflare Pages（免费，带宽不限）

适合以后流量变大、又不想付费的场景。

1. 注册 [Cloudflare](https://dash.cloudflare.com/) 账号
2. 左侧 **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 授权并选择本仓库
4. 构建设置全部留空：
   - Framework preset: `None`
   - Build command: 留空
   - Build output directory: `/`
5. 保存后即可通过 `https://<项目名>.pages.dev` 访问

也可以在本地直接拖拽整个文件夹上传，完全不用 Git。

---

## 四、方案 C：国内节点（需要备案）

如果访问者主要在国内，且对速度有要求：

1. 买域名（约 ¥10 起，见下方成本）
2. 买国内云服务器或对象存储，做 **ICP 备案**（备案本身免费，但需 1~3 周审核）
3. 把文件上传到对象存储，开启「静态网站托管」，绑定已备案域名

**备案是硬门槛**：使用中国大陆境内的服务器 + 自定义域名，必须完成 ICP 备案。

---

## 五、成本参考

| 项目 | 费用 |
| --- | --- |
| GitHub Pages / Cloudflare Pages 托管 | **¥0** |
| `https://xxx.github.io/repo/` 自带域名 | **¥0** |
| 自定义域名 `.top` / `.xyz` | 约 ¥10 ~ 40 / 年（首年常有优惠） |
| 自定义域名 `.com` | 约 ¥65 ~ 90 / 年 |
| HTTPS 证书 | ¥0（托管平台自动签发） |
| 国内对象存储 | 约 ¥1 ~ 10 / 月（按流量） |

**最低成本路线：¥0 全免费上线。** 想要好记的网址，再加约 ¥10/年 买个域名。

---

## 六、上线前检查清单

- [ ] `_shots/`、`_tmp_*.html`、`_backup_*.html` 不要部署
- [ ] `.nojekyll` 已保留在根目录（防止 GitHub Pages 的 Jekyll 处理异常）
- [x] 高德地图瓦片已从 `http://` 改为 `https://`，避免 GitHub Pages 的
      HTTPS 页面拦截混合内容
- [x] 根入口会自动分流电脑端/移动端，五个共享目录均使用相对路径
- [x] 已删除未使用的 `js/vendor/three.module.js`（1.27 MB）和
      `js/vendor/OrbitControls.js`（30 KB）——线上页面只用了 `*.global.js` 版本
- [ ] 压缩图片：`images/team-badge.png` 有 1.6 MB，但只在页头显示成小徽章，
      建议缩到 256×256（体积可降到约 20 KB）。这是全站最大的性能瓶颈
- [x] 已删除无引用的 `images/001.png`、`images/002.png`

---

## 七、本地预览

在项目根目录执行：

```powershell
node -e "const h=require('http'),f=require('fs'),p=require('path');const t={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};h.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.endsWith('/'))u+='index.html';const x=p.join(process.cwd(),u);f.readFile(x,(e,d)=>{if(e){s.writeHead(404);return s.end('Not found')}s.writeHead(200,{'Content-Type':t[p.extname(x)]||'application/octet-stream'});s.end(d)})}).listen(8000,()=>console.log('http://127.0.0.1:8000'))"
```

然后浏览器打开 http://127.0.0.1:8000 。如果本机没有 Node.js，也可以在
VS Code 中安装 Live Server 插件，右键根目录 `index.html` 选择 **Open with Live Server**。
