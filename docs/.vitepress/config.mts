import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Z-Drive",
  description: "Z-Drive project documentation",
  lang: "zh-CN",
  base: "/",
  cleanUrls: true,
  head: [["link", { rel: "icon", href: "/favicon.ico" }]],
  themeConfig: {
    siteTitle: "Z-Drive Docs",
    logo: '/z-drive.webp',
    nav: [
      { text: "首页", link: "/" },
      { text: "快速开始", link: "/guide/getting-started" },
      { text: "部署说明", link: "/guide/deploy" }
    ],
    sidebar: [
      {
        text: "指南",
        items: [
          { text: "快速开始", link: "/guide/getting-started" },
          { text: "部署说明", link: "/guide/deploy" }
        ]
      },
      {
        text: "参考",
        items: [
          { text: "架构与简介", link: "/reference/architecture" },
          { text: "后端与模型", link: "/reference/backend" },
          { text: "接口与路由", link: "/reference/api" },
          { text: "配置项", link: "/reference/config" }
        ]
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/ThinkerWen/z-drive" }
    ]
  }
});
