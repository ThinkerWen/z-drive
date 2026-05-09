import * as React from "react"
import { GalleryVerticalEnd, Image as ImageIcon, Cloud, Code } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "图床管理",
      url: "/gallery",
      icon: ImageIcon,
      items: [
        { title: "上传图片", url: "/gallery/upload" },
        { title: "图库", url: "/gallery/index" },
        { title: "统计", url: "/gallery/stats" },
      ],
    },
    {
      title: "云盘管理",
      url: "/cloud",
      icon: Cloud,
      items: [
        { title: "上传文件", url: "/cloud/upload" },
        { title: "文件列表", url: "/cloud/index" },
        { title: "分享管理", url: "/cloud/shares" },
        { title: "统计", url: "/cloud/stats" },
      ],
    },
    {
      title: "代码片段",
      url: "/snippets",
      icon: Code,
      items: [
        { title: "发布代码", url: "/snippets/editor" },
        { title: "片段列表", url: "/snippets/index" },
        { title: "分享管理", url: "/snippets/shares" },
        { title: "统计", url: "/snippets/stats" },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/gallery/index">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <GalleryVerticalEnd className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Z-Drive</span>
                  <span className="text-xs">Management</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => {
              const isActive = location.pathname.startsWith(item.url)
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive}>
                    <Link to={item.items[0].url} className="font-medium">
                      <item.icon className="size-4" />
                      {item.title}
                    </Link>
                  </SidebarMenuButton>
                  {item.items?.length ? (
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={location.pathname === subItem.url}>
                            <Link to={subItem.url}>{subItem.title}</Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
