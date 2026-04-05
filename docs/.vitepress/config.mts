import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Z-Drive",
  description: "Z-Drive project documentation",
  lang: "zh-CN",
  base: "/",
  cleanUrls: true,
  themeConfig: {
    siteTitle: "Z-Drive Docs",
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
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/ThinkerWen/z-drive" }
    ]
  }
});
