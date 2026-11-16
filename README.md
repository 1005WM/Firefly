# Autumn Blog · 叶三秋的博客

> Do what you like.
>
> 做自己喜欢的事情。

记录做过的项目、读过的源码，以及日常用得上的工具和资源。这是 Autumn Blog 的网站源码，基于 Astro、Svelte 和 Firefly 构建。

[在线博客](https://blog.0913000.xyz/) · [文章列表](https://blog.0913000.xyz/posts/) · [工具库](https://blog.0913000.xyz/booknav/) · [动态](https://blog.0913000.xyz/dynamic/)

## 博客内容

- **文章**：技术分析、好物分享、优质工具、资源整理。置顶文章单独展示，列表支持切换为网格视图。
- **阅读**：文章支持封面、阅读进度、随滚动更新的目录，以及 Pagefind 全文搜索。
- **其他页面**：工具库、项目、动态、相册、友链和留言板。
- **界面**：使用霞鹜文楷（LXGW WenKai），支持亮色与暗色。桌面导航的高亮会跟随鼠标移动。

## 本地运行

需要 Node.js 22.23.0 或更高版本，以及 pnpm 11.22.0。

```bash
git clone https://github.com/1005WM/Firefly.git
cd Firefly
pnpm install
pnpm dev
```

开发预览地址：[http://localhost:4321](http://localhost:4321/)。

| 命令 | 用途 |
| --- | --- |
| `pnpm new-post my-post` | 在 `src/content/posts/` 下创建 Markdown 文章 |
| `pnpm new-d "今天的动态"` | 创建一条动态 |
| `pnpm check`、`pnpm type-check` | 检查 Astro 与 TypeScript |
| `pnpm build` | 构建站点和搜索索引，输出到 `dist/` |
| `pnpm preview` | 预览构建产物 |

仓库提供 [GitHub Pages 部署工作流](.github/workflows/deploy.yml)，可在推送到 `master` 时触发。

## 内容与配置

文章放在 [`src/content/posts/`](src/content/posts/)，动态放在 [`src/content/dynamic/`](src/content/dynamic/)。新文章可在文件头通过 `category` 指定列表分区，例如 `category: 技术分析`。现有的「嵌入式」和「源码解析」也归入「技术分析」。封面通过 `image` 设置，例如 `image: './images/qct-nva-cover.avif'`；需要置顶时设置 `pinned: true`。

站点名称和网址在 [`siteConfig.ts`](src/config/siteConfig.ts)，菜单在 [`navBarConfig.ts`](src/config/navBarConfig.ts)，首页壁纸和标语在 [`backgroundWallpaper.ts`](src/config/backgroundWallpaper.ts)。其他选项请看[配置目录说明](src/config/README.md)。

## 致谢与许可

- 博客基于 [CuteLeaf/Firefly](https://github.com/CuteLeaf/Firefly)（源自 [saicaca/fuwari](https://github.com/saicaca/fuwari)）。主题的通用配置可参考 [Firefly 使用文档](https://docs-firefly.cuteleaf.cn/)。
- 部分页面、动态目录和导航样式改编自 [团子和蛋糕的博客](https://github.com/tianshihao2003/dumplingandcakeblog)。改编范围见[参考界面说明](docs/reference-ui.md)，原许可见 [MIT 声明](docs/dumplingandcakeblog-LICENSE.txt)。
- 项目代码采用 [MIT 许可证](LICENSE)，保留 saicaca 与 CuteLeaf 的版权声明。原主题的《崩坏：星穹铁道》相关素材版权归米哈游所有。

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->
