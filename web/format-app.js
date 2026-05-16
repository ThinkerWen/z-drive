const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const importSidebar = import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";\nimport { AppSidebar } from "@/components/app-sidebar";\nimport { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";\nimport { Separator } from "@/components/ui/separator";\n;

content = content.replace('import { Button } from "@/components/ui/button";', importSidebar + 'import { Button } from "@/components/ui/button";');

const oldReturnStart =   return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="rounded-xl border bg-card p-7 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">{activeBrand}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">管理控制台</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              专注个人使用的云工具平台
            </p>
          </div>
          <div className="flex gap-2">
            {isAuthed ? (
              <Button variant="outline" onClick={() => void handleLogout()} disabled={busy}>
                <LogOut className="mr-2 h-4 w-4" />
                退出
              </Button>
            ) : null}
          </div>
        </div>
        {isAuthed ? (
          <>
            <nav className="mt-5 flex flex-wrap gap-2 rounded-xl border bg-muted/30 p-2">
              <TabButton current={activeSection} target="gallery" onClick={() => {
                setActiveSection("gallery");
                setActiveGalleryPage("gallery");
                navigate("/gallery/index");
              }}>图库</TabButton>
              <TabButton current={activeSection} target="cloud" onClick={() => {
                setActiveSection("cloud");
                setActiveCloudPage("files");
                navigate("/cloud/index");
              }}>云盘</TabButton>
              <TabButton current={activeSection} target="snippet" onClick={() => {
                setActiveSection("snippet");
                setActiveSnippetPage("editor");
                navigate("/snippets/editor");
              }}>代码片</TabButton>
            </nav>
            {activeSection === "gallery" ? (
              <nav className="mt-3 flex flex-wrap gap-2 rounded-2xl border bg-muted/30 p-2">
                <TabButton current={activeGalleryPage} target="upload" onClick={() => {
                  setActiveGalleryPage("upload");
                  navigate("/gallery/upload");
                }}>上传</TabButton>
                <TabButton current={activeGalleryPage} target="gallery" onClick={() => {
                  setActiveGalleryPage("gallery");
                  navigate("/gallery/index");
                }}>图库</TabButton>
                <TabButton current={activeGalleryPage} target="stats" onClick={() => {
                  setActiveGalleryPage("stats");
                  navigate("/gallery/stats");
                }}>统计</TabButton>
              </nav>
            ) : activeSection === "cloud" ? (
              <nav className="mt-3 flex flex-wrap gap-2 rounded-2xl border bg-muted/30 p-2">
                <TabButton current={activeCloudPage} target="upload" onClick={() => {
                  setActiveCloudPage("upload");
                  navigate("/cloud/upload");
                }}>上传</TabButton>
                <TabButton current={activeCloudPage} target="files" onClick={() => {
                  setActiveCloudPage("files");
                  navigate("/cloud/index");
                }}>文件管理</TabButton>
                <TabButton current={activeCloudPage} target="shares" onClick={() => {
                  setActiveCloudPage("shares");
                  navigate("/cloud/shares");
                }}>分享管理</TabButton>
                <TabButton current={activeCloudPage} target="stats" onClick={() => {
                  setActiveCloudPage("stats");
                  navigate("/cloud/stats");
                }}>数据统计</TabButton>
              </nav>
            ) : (
              <nav className="mt-3 flex flex-wrap gap-2 rounded-2xl border bg-muted/30 p-2">
                <TabButton current={activeSnippetPage} target="editor" onClick={() => {
                  setActiveSnippetPage("editor");
                  navigate(getSnippetRoute("editor"));
                }}>编辑器</TabButton>
                <TabButton current={activeSnippetPage} target="list" onClick={() => {
                  setActiveSnippetPage("list");
                  navigate(getSnippetRoute("list"));
                }}>代码片列表</TabButton>
                <TabButton current={activeSnippetPage} target="shares" onClick={() => {
                  setActiveSnippetPage("shares");
                  navigate(getSnippetRoute("shares"));
                }}>分享管理</TabButton>
                <TabButton current={activeSnippetPage} target="stats" onClick={() => {
                  setActiveSnippetPage("stats");
                  navigate(getSnippetRoute("stats"));
                }}>数据统计</TabButton>
              </nav>
            )}
          </>
        ) : null}
      </header>

      <>;

const newReturnStart =   return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{activeBrand}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          {isAuthed ? (
            <Button variant="ghost" size="icon" onClick={() => void handleLogout()} disabled={busy} title="退出登录">
               <LogOut className="h-4 w-4" />
            </Button>
          ) : null}
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0 mt-4">;

content = content.replace(oldReturnStart, newReturnStart);

const oldReturnEnd =       </>
      <ToastPopup toast={toast} />
    </div>
  );;

const newReturnEnd =         </div>
      </SidebarInset>
      <ToastPopup toast={toast} />
    </SidebarProvider>
  );;

content = content.replace(oldReturnEnd, newReturnEnd);

fs.writeFileSync('src/App.tsx', content);
