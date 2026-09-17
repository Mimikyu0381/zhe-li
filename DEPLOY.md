# 部署指南：把本站变成可访问的网站

本项目是**纯静态网站**（HTML + CSS + JS + 图片），没有任何后端代码，
所有资源引用都是相对路径，因此可以托管在任何静态托管服务上，无需买服务器。

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

```powershell
git add .
git commit -m "初始化站点"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> 注意：GitHub Pages 对**公开仓库免费**；私有仓库要用 Pages 需要付费的 GitHub Pro。
> 把这个仓库设为 Public 即可零成本。

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

- [ ] `_shots/`、`_tmp_*.html`、`_backup_*.html` 不要部署（已写入 `.gitignore`）
- [ ] `.nojekyll` 已保留在根目录（防止 GitHub Pages 的 Jekyll 处理异常）
- [ ] 删掉或瘦身未使用的 `js/vendor/three.module.js`（1.27 MB）和
      `js/vendor/OrbitControls.js`（30 KB）——线上页面只用了 `*.global.js` 版本
- [ ] 压缩图片：`images/team-badge.png` 有 1.6 MB，但只在页头显示成小徽章，
      建议缩到 256×256（体积可降到约 20 KB）。这是全站最大的性能瓶颈
- [ ] `images/001.png`、`images/002.png` 实际是 **WebP 格式**却用了 `.png` 后缀，
      部分严格校验 MIME 的托管商可能显示异常，建议改名为 `.webp`

---

## 七、本地预览

在项目根目录执行：

```powershell
python -m http.server 8000
```

然后浏览器打开 http://localhost:8000