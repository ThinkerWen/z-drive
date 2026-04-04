import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, Copy, ExternalLink, Loader2, LogOut, Palette, Shield, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ApiError,
  deleteImage,
  getStats,
  listImages,
  login,
  logout,
  updateAccessMode,
} from "@/lib/api";
import type { AccessMode, ImageListItem, StatsResponse, UploadResultItem } from "@/lib/types";

const PAGE_SIZE = 8;
type ManagePage = "login" | "upload" | "gallery" | "stats";
type UploadTaskStatus = "uploading" | "processing" | "success" | "error" | "cancelled";
type ThemeName = "amber" | "ocean" | "forest" | "rose" | "midnight";

const THEME_OPTIONS: Array<{ key: ThemeName; label: string; preview: string }> = [
  { key: "amber", label: "琥珀", preview: "#ea580c" },
  { key: "ocean", label: "海蓝", preview: "#0ea5e9" },
  { key: "forest", label: "森林", preview: "#16a34a" },
  { key: "rose", label: "玫红", preview: "#f43f5e" },
  { key: "midnight", label: "黑夜", preview: "#111827" },
];

interface UploadTask {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  status: UploadTaskStatus;
  result?: UploadResultItem;
  error?: string;
}

const TrendLineChart = lazy(async () => {
  const module = await import("@/components/stats/trend-line-chart");
  return { default: module.TrendLineChart };
});

export default function App() {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activePage, setActivePage] = useState<ManagePage>("upload");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [items, setItems] = useState<ImageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [fileType, setFileType] = useState("all");

  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [selectedFilesLabel, setSelectedFilesLabel] = useState("未选择文件");
  const [copiedKey, setCopiedKey] = useState("");
  const [previewItem, setPreviewItem] = useState<ImageListItem | null>(null);
  const [accessModalItem, setAccessModalItem] = useState<ImageListItem | null>(null);
  const [accessModalMode, setAccessModalMode] = useState<AccessMode>("none");
  const [accessModalPassword, setAccessModalPassword] = useState("");
  const [accessModalKeepExisting, setAccessModalKeepExisting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageListItem | null>(null);
  const [theme, setTheme] = useState<ThemeName>("amber");
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const activeUploadsRef = useRef<Record<string, XMLHttpRequest>>({});

  const pageCount = useMemo(() => Math.max(Math.ceil(total / PAGE_SIZE), 1), [total]);

  async function refreshList(targetPage = page, nextQuery = query, nextFileType = fileType): Promise<void> {
    try {
      const listData = await listImages({
        page: targetPage,
        pageSize: PAGE_SIZE,
        query: nextQuery,
        fileType: nextFileType,
      });
      setItems(listData.items);
      setTotal(listData.total);
      setPage(listData.page);
      setIsAuthed(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setIsAuthed(false);
        setMessage("请先登录管理账号");
        return;
      }
      setMessage(error instanceof Error ? error.message : "加载失败");
    }
  }

  async function refreshStats(): Promise<void> {
    try {
      const statsData = await getStats();
      setStats(statsData);
      setIsAuthed(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setIsAuthed(false);
        setActivePage("login");
        setMessage("请先登录管理账号");
        return;
      }
      setMessage(error instanceof Error ? error.message : "统计加载失败");
    }
  }

  useEffect(() => {
    void (async () => {
      setAuthLoading(true);
      await Promise.all([refreshStats(), refreshList(1)]);
      setAuthLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("z-drive-theme") as ThemeName | null;
    const normalized = saved && THEME_OPTIONS.some((option) => option.key === saved) ? saved : "amber";
    setTheme(normalized);
    if (normalized === "amber") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", normalized);
    }
  }, []);

  function applyTheme(nextTheme: ThemeName) {
    setTheme(nextTheme);
    localStorage.setItem("z-drive-theme", nextTheme);
    if (nextTheme === "amber") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
    setThemePickerOpen(false);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await login(username, password);
      setPassword("");
      await Promise.all([refreshStats(), refreshList(1)]);
      setActivePage("upload");
      setMessage("登录成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement | null;
    if (!input?.files?.length) {
      setMessage("请选择至少一个文件");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const files = Array.from(input.files);
      const tasks = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
        status: "uploading" as UploadTaskStatus,
      }));
      setUploadTasks((prev) => [...tasks, ...prev]);

      const settled = await Promise.allSettled(tasks.map((task) => uploadFileTask(task.id, task.file)));
      const successCount = settled.filter((item) => item.status === "fulfilled").length;
      setMessage(`上传完成：成功 ${successCount} / ${tasks.length}`);

      form.reset();
      setSelectedFilesLabel("未选择文件");
      await Promise.all([refreshStats(), refreshList(1)]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  function updateTask(id: string, updater: (task: UploadTask) => UploadTask) {
    setUploadTasks((prev) => prev.map((task) => (task.id === id ? updater(task) : task)));
  }

  async function uploadFileTask(taskId: string, file: File): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/gallery/api/upload", true);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (progressEvent) => {
        if (!progressEvent.lengthComputable) {
          return;
        }
        const percent = Math.min(100, Math.round((progressEvent.loaded / progressEvent.total) * 100));
        updateTask(taskId, (task) => ({ ...task, progress: percent, status: percent >= 100 ? "processing" : "uploading" }));
      };

      xhr.onload = () => {
        delete activeUploadsRef.current[taskId];
        let payload: Record<string, unknown> | null = null;
        try {
          payload = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : null;
        } catch {
          payload = null;
        }

        if (xhr.status < 200 || xhr.status >= 300 || !payload) {
          const detail = typeof payload?.detail === "string" ? payload.detail : "上传失败";
          updateTask(taskId, (task) => ({ ...task, status: "error", error: detail }));
          reject(new Error(detail));
          return;
        }

        const successResult: UploadResultItem = {
          file_name: String(payload.file_name ?? file.name),
          file_size: Number(payload.file_size ?? file.size),
          file_type: String(payload.file_type ?? file.type.split("/")[0] ?? "file"),
          success: true,
          short_code: String(payload.short_code ?? ""),
          view_url: typeof payload.view_url === "string" ? payload.view_url : undefined,
          direct_url: typeof payload.direct_url === "string" ? payload.direct_url : undefined,
          preview_url: typeof payload.preview_url === "string" ? payload.preview_url : undefined,
          sign: typeof payload.sign === "string" ? payload.sign : undefined,
        };

        updateTask(taskId, (task) => ({
          ...task,
          progress: 100,
          status: "success",
          result: successResult,
          error: undefined,
        }));
        resolve();
      };

      xhr.onerror = () => {
        delete activeUploadsRef.current[taskId];
        updateTask(taskId, (task) => ({ ...task, status: "error", error: "网络错误" }));
        reject(new Error("网络错误"));
      };

      xhr.onabort = () => {
        delete activeUploadsRef.current[taskId];
        updateTask(taskId, (task) => ({ ...task, status: "cancelled", error: "上传已取消" }));
        reject(new Error("上传已取消"));
      };

      const form = new FormData();
      form.append("file", file);
      form.append("access_mode", "none");
      xhr.send(form);
      activeUploadsRef.current[taskId] = xhr;
    });
  }

  function cancelUpload(taskId: string) {
    const xhr = activeUploadsRef.current[taskId];
    if (xhr) {
      xhr.abort();
      delete activeUploadsRef.current[taskId];
    }
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      setSelectedFilesLabel("未选择文件");
      return;
    }
    if (fileList.length === 1) {
      setSelectedFilesLabel(fileList[0].name);
      return;
    }
    setSelectedFilesLabel(`已选择 ${fileList.length} 个文件`);
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1500);
    } catch {
      setMessage("复制失败，请手动复制");
    }
  }

  async function handleDelete(shortCode: string) {
    setBusy(true);
    setMessage("");
    try {
      await deleteImage(shortCode);
      await Promise.all([refreshStats(), refreshList(page)]);
      setMessage("删除成功");
      setDeleteTarget(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccessModeChange(item: ImageListItem, nextMode: AccessMode) {
    setBusy(true);
    setMessage("");
    try {
      await updateAccessMode(item.short_code, nextMode);
      await refreshList(page);
      setMessage("访问模式已更新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
    } finally {
      setBusy(false);
    }
  }

  function openAccessModeModal(item: ImageListItem) {
    setAccessModalItem(item);
    setAccessModalMode(item.access_mode);
    setAccessModalPassword("");
    setAccessModalKeepExisting(item.access_mode === "individual" && Boolean(item.sign));
  }

  function generatePassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let password = "";
    for (let i = 0; i < 12; i += 1) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAccessModalPassword(password);
    setAccessModalKeepExisting(false);
  }

  async function saveAccessMode() {
    if (!accessModalItem) {
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      let sign = "";
      if (accessModalMode === "individual") {
        if (accessModalPassword.trim()) {
          sign = accessModalPassword.trim();
        } else if (accessModalKeepExisting && accessModalItem.sign) {
          sign = accessModalItem.sign;
        }
      }

      await updateAccessMode(accessModalItem.short_code, accessModalMode, sign);
      await refreshList(page);
      setMessage("访问模式已更新");
      setAccessModalItem(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新失败");
    } finally {
      setBusy(false);
    }
  }

  function buildSignedShortLink(item: ImageListItem) {
    return item.view_url;
  }

  function openPreviewPage(item: ImageListItem) {
    window.open(item.preview_url, "_blank");
  }

  async function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await refreshList(1);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    await logout();
    setBusy(false);
    setIsAuthed(false);
    setActivePage("login");
    setStats(null);
    setItems([]);
    setTotal(0);
    setMessage("已退出登录");
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isLoginView = !isAuthed || activePage === "login";

  if (isLoginView) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-8">
        <section className="soft-panel w-full max-w-md rounded-3xl p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">Z-Drive Imagebed</p>
          <h2 className="mt-3 text-2xl font-semibold">管理员登录</h2>
          <p className="mt-1 text-sm text-muted-foreground">请输入管理凭据后进入工作台。</p>
          <form className="mt-5 space-y-3" onSubmit={handleLogin}>
            <input
              className="w-full rounded-xl border border-white/80 bg-white/80 px-3 py-2.5 text-sm outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              className="w-full rounded-xl border border-white/80 bg-white/80 px-3 py-2.5 text-sm outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button className="w-full" disabled={busy}>
              {busy ? "登录中..." : "登录"}
            </Button>
          </form>
          {message ? <p className="mt-4 rounded-xl bg-white/60 px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
      <header className="glass-panel rounded-3xl p-7 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">Z-Drive Imagebed</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">图床管理</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              供个人用户使用，面向生产环境的一体化图床能力。
            </p>
          </div>
          <div className="flex gap-2">
            {isAuthed ? (
              <>
                <div className="relative">
                  <Button
                    variant="outline"
                    onClick={() => setThemePickerOpen((value) => !value)}
                    disabled={busy}
                  >
                    <Palette className="mr-2 h-4 w-4" />
                    主题
                  </Button>
                  {themePickerOpen ? (
                    <div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-border/70 bg-white/95 p-2 shadow-xl backdrop-blur">
                      {THEME_OPTIONS.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={
                            theme === option.key
                              ? "mb-1 flex w-full items-center gap-2 rounded-lg bg-primary/10 px-2 py-1.5 text-left text-xs font-semibold"
                              : "mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-muted"
                          }
                          onClick={() => applyTheme(option.key)}
                        >
                          <span className="inline-block h-3 w-3 rounded-full border" style={{ background: option.preview }} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button variant="outline" onClick={() => void handleLogout()} disabled={busy}>
                  <LogOut className="mr-2 h-4 w-4" />
                  退出
                </Button>
              </>
            ) : null}
          </div>
        </div>
        {isAuthed ? (
          <nav className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-white/60 bg-white/55 p-2">
            <TabButton current={activePage} target="upload" onClick={setActivePage}>上传页</TabButton>
            <TabButton current={activePage} target="gallery" onClick={setActivePage}>图库页</TabButton>
            <TabButton current={activePage} target="stats" onClick={setActivePage}>统计页</TabButton>
          </nav>
        ) : null}
        {message ? <p className="mt-4 rounded-xl bg-white/60 px-3 py-2 text-sm text-muted-foreground">{message}</p> : null}
      </header>

      <>
          {activePage === "upload" ? (
            <section className="soft-panel rounded-3xl p-5 sm:p-6">
            <h2 className="mb-3 flex items-center text-lg font-semibold">
              <Upload className="mr-2 h-5 w-5" /> 上传页
            </h2>
            <form className="grid gap-3 md:grid-cols-[1fr_170px]" onSubmit={handleUpload}>
              <div className="flex items-center gap-3 rounded-xl border border-white/70 bg-white/75 px-2 py-2 shadow-sm">
                <input
                  id="upload-files"
                  name="files"
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={handleFileInputChange}
                />
                <label
                  htmlFor="upload-files"
                  className="cursor-pointer rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-[0_8px_16px_rgba(234,88,12,0.24)] transition hover:-translate-y-0.5 hover:bg-primary/95"
                >
                  选择文件
                </label>
                <span className="truncate text-sm text-muted-foreground" title={selectedFilesLabel}>
                  {selectedFilesLabel}
                </span>
              </div>
              <Button disabled={busy}>{busy ? "上传中..." : "开始上传"}</Button>
            </form>

            {uploadTasks.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {uploadTasks.map((task, index) => {
                  const result = task.result;
                  const shortLink = result?.view_url ?? "";
                  const isVideo = result?.file_type === "video";
                  const fileName = result?.file_name ?? task.file.name;
                  const markdown = `![${fileName}](${shortLink})`;
                  const imgTag = `<img src=\"${shortLink}\" width=\"500\" alt=\"${fileName}\" />`;
                  const videoTag = `<video src=\"${shortLink}\" controls width=\"500\"></video>`;

                  return (
                    <article
                      key={task.id}
                      className="rounded-2xl border border-border/70 bg-white/82 p-4 shadow-[0_8px_18px_rgba(106,71,30,0.08)]"
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        {result?.success && result.view_url ? (
                          isVideo ? (
                            <video
                              src={result.view_url}
                              className="h-16 w-16 rounded-lg border border-border/70 object-cover"
                              muted
                            />
                          ) : (
                            <img
                              src={result.view_url ?? task.previewUrl}
                              alt={result.file_name ?? task.file.name}
                              className="h-16 w-16 rounded-lg border border-border/70 object-cover"
                            />
                          )
                        ) : (
                          <img
                            src={task.previewUrl}
                            alt={task.file.name}
                            className="h-16 w-16 rounded-lg border border-border/70 object-cover"
                          />
                        )}

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{result?.file_name ?? task.file.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatFileSize(result?.file_size ?? task.file.size)}
                          </p>
                        </div>

                        <span
                          className={
                            task.status === "success"
                              ? "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700"
                              : task.status === "cancelled"
                                ? "rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                                : task.status === "processing" || task.status === "uploading"
                                  ? "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700"
                              : "rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700"
                          }
                        >
                          {task.status === "success"
                            ? "上传成功"
                            : task.status === "cancelled"
                              ? "已取消"
                              : task.status === "processing"
                                ? "处理中"
                                : task.status === "uploading"
                                  ? `上传中 ${task.progress}%`
                                  : `上传失败: ${task.error ?? "unknown"}`}
                        </span>
                        {task.status === "uploading" || task.status === "processing" ? (
                          <button
                            type="button"
                            className="rounded-md border border-border/80 bg-white px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted"
                            onClick={() => cancelUpload(task.id)}
                          >
                            取消
                          </button>
                        ) : null}
                      </div>

                      {task.status === "uploading" || task.status === "processing" ? (
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      ) : null}

                      {result?.success && result.view_url ? (
                        <div className="mt-3 grid gap-2">
                          <CopyRow
                            label="短链接"
                            value={shortLink}
                            copied={copiedKey === `link-${index}`}
                            onCopy={() => void copyText(shortLink, `link-${index}`)}
                          />

                          {isVideo ? (
                            <CopyRow
                              label="VIDEO 标签"
                              value={videoTag}
                              copied={copiedKey === `video-${index}`}
                              onCopy={() => void copyText(videoTag, `video-${index}`)}
                            />
                          ) : (
                            <>
                              <CopyRow
                                label="Markdown"
                                value={markdown}
                                copied={copiedKey === `md-${index}`}
                                onCopy={() => void copyText(markdown, `md-${index}`)}
                              />
                              <CopyRow
                                label="IMG 标签"
                                value={imgTag}
                                copied={copiedKey === `img-${index}`}
                                onCopy={() => void copyText(imgTag, `img-${index}`)}
                              />
                            </>
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border/80 bg-white/55 px-4 py-6 text-center text-sm text-muted-foreground">
                暂无上传记录
              </div>
            )}
            </section>
          ) : null}

          {activePage === "gallery" ? (
            <section className="soft-panel rounded-3xl p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">图库页</h2>
            <form className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-white/70 bg-white/70 p-3" onSubmit={applyFilters}>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={fileType === "image" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFileType("image");
                    void refreshList(1, query, "image");
                  }}
                >
                  图片
                </Button>
                <Button
                  type="button"
                  variant={fileType === "video" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setFileType("video");
                    void refreshList(1, query, "video");
                  }}
                >
                  视频
                </Button>
              </div>
              <input
                className="min-w-64 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="搜索文件名或短码"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <Button disabled={busy}>查询</Button>
            </form>

            {items.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {items.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-2xl border border-border/70 bg-white/85 shadow-[0_8px_18px_rgba(106,71,30,0.08)] transition hover:-translate-y-0.5">
                    <button
                      type="button"
                      className="block h-40 w-full overflow-hidden bg-muted"
                      onClick={() => setPreviewItem(item)}
                    >
                      {item.file_type === "video" ? (
                        <video src={item.view_url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={item.view_url} alt={item.file_name} className="h-full w-full object-cover" />
                      )}
                    </button>
                    <div className="space-y-3 p-3">
                      <p className="truncate text-xs font-semibold" title={item.file_name}>{item.file_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(item.file_size)} · {item.width}x{item.height} · 浏览 {item.view_count}
                      </p>
                      <div className="grid gap-1.5">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1 px-2 text-[11px]"
                            onClick={() => void copyText(buildSignedShortLink(item), `short-${item.short_code}`)}
                          >
                            <Copy className="mr-1 h-3.5 w-3.5" />
                            {copiedKey === `short-${item.short_code}` ? "已复制" : "复制短链"}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 flex-1 px-2 text-[11px]" onClick={() => openPreviewPage(item)}>
                            <ExternalLink className="mr-1 h-3.5 w-3.5" /> 预览页
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1 px-2 text-[11px]"
                            onClick={() => openAccessModeModal(item)}
                          >
                            <Shield className="mr-1 h-3.5 w-3.5" /> 修改访问
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 flex-1 px-2 text-[11px]"
                            onClick={() => {
                              setDeleteTarget(item);
                            }}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" /> 删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 bg-white/55 px-4 py-10 text-center text-sm text-muted-foreground">
                暂无符合条件的文件
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">共 {total} 条，当前第 {page} / {pageCount} 页</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || page <= 1}
                  onClick={() => {
                    void refreshList(page - 1);
                  }}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || page >= pageCount}
                  onClick={() => {
                    void refreshList(page + 1);
                  }}
                >
                  下一页
                </Button>
              </div>
            </div>
            {previewItem ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
                onClick={() => setPreviewItem(null)}
              >
                <div
                  className="w-full max-w-4xl rounded-3xl border border-white/70 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="truncate text-base font-semibold">{previewItem.file_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">点击遮罩可关闭预览</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setPreviewItem(null)}>关闭</Button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                    <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/60">
                    {previewItem.file_type === "video" ? (
                      <video src={previewItem.view_url} controls className="max-h-[70vh] w-full" />
                    ) : (
                      <img src={previewItem.view_url} alt={previewItem.file_name} className="max-h-[70vh] w-auto" />
                    )}
                    </div>

                    <aside className="space-y-3">
                      <div className="rounded-2xl border border-border/70 bg-muted/45 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">链接</p>
                        <div className="space-y-2">
                          <MiniCopyRow
                            label="短链接"
                            value={buildSignedShortLink(previewItem)}
                            copied={copiedKey === `preview-short-${previewItem.short_code}`}
                            onCopy={() => void copyText(buildSignedShortLink(previewItem), `preview-short-${previewItem.short_code}`)}
                          />
                          <MiniCopyRow
                            label="访问链接"
                            value={previewItem.view_url}
                            copied={copiedKey === `preview-view-${previewItem.short_code}`}
                            onCopy={() => void copyText(previewItem.view_url, `preview-view-${previewItem.short_code}`)}
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-white/80 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">基础信息</p>
                        <dl className="grid grid-cols-2 gap-2 text-xs">
                          <InfoCell label="短码" value={previewItem.short_code} />
                          <InfoCell label="类型" value={previewItem.file_type} />
                          <InfoCell label="MIME" value={previewItem.mime_type} />
                          <InfoCell label="尺寸" value={`${previewItem.width} x ${previewItem.height}`} />
                          <InfoCell label="浏览" value={String(previewItem.view_count)} />
                          <InfoCell label="下载" value={String(previewItem.download_count)} />
                        </dl>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-white/80 p-3 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground">创建时间</p>
                        <p className="mt-1">{previewItem.created_at}</p>
                      </div>
                    </aside>
                  </div>
                </div>
              </div>
            ) : null}

            {accessModalItem ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
                onClick={() => setAccessModalItem(null)}
              >
                <div
                  className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <h3 className="text-base font-semibold">设置访问模式</h3>
                  <p className="mt-1 text-xs text-muted-foreground">文件: {accessModalItem.file_name}</p>

                  <div className="mt-4 space-y-3">
                    <button
                      type="button"
                      className={
                        accessModalMode === "none"
                          ? "w-full rounded-xl border-2 border-primary bg-primary/5 p-3 text-left"
                          : "w-full rounded-xl border border-border/70 bg-white p-3 text-left"
                      }
                      onClick={() => {
                        setAccessModalMode("none");
                        setAccessModalKeepExisting(false);
                      }}
                    >
                      <p className="text-sm font-semibold">公开访问</p>
                      <p className="mt-1 text-xs text-muted-foreground">任何人都可以访问此文件</p>
                    </button>

                    <button
                      type="button"
                      className={
                        accessModalMode === "individual"
                          ? "w-full rounded-xl border-2 border-primary bg-primary/5 p-3 text-left"
                          : "w-full rounded-xl border border-border/70 bg-white p-3 text-left"
                      }
                      onClick={() => setAccessModalMode("individual")}
                    >
                      <p className="text-sm font-semibold">独立验证</p>
                      <p className="mt-1 text-xs text-muted-foreground">为该文件设置独立访问密码</p>

                      {accessModalMode === "individual" ? (
                        <div className="mt-3 rounded-lg border border-border/70 bg-muted/40 p-3">
                          <p className="text-[11px] font-semibold text-muted-foreground">访问密码</p>
                          <p className="mt-1 truncate rounded bg-white px-2 py-1 font-mono text-xs" title={accessModalPassword || (accessModalKeepExisting ? "****** (已设置)" : "") }>
                            {accessModalPassword || (accessModalKeepExisting ? "****** (已设置)" : "未生成")}
                          </p>
                          <div className="mt-2 flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 flex-1 text-[11px]"
                              onClick={generatePassword}
                            >
                              重新生成
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 flex-1 text-[11px]"
                              onClick={() => {
                                if (accessModalPassword) {
                                  void copyText(accessModalPassword, "access-password");
                                }
                              }}
                              disabled={!accessModalPassword}
                            >
                              {copiedKey === "access-password" ? "已复制" : "复制密码"}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </button>
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAccessModalItem(null)}
                      disabled={busy}
                    >
                      取消
                    </Button>
                    <Button type="button" onClick={() => void saveAccessMode()} disabled={busy}>
                      保存
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {deleteTarget ? (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
                onClick={() => setDeleteTarget(null)}
              >
                <div
                  className="w-full max-w-md rounded-3xl border border-white/70 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                  onClick={(event) => event.stopPropagation()}
                >
                  <h3 className="text-base font-semibold">删除确认</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    确定要删除 {deleteTarget.file_name} 吗？此操作不可恢复。
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setDeleteTarget(null)}
                      disabled={busy}
                    >
                      取消
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        void handleDelete(deleteTarget.short_code);
                      }}
                      disabled={busy}
                    >
                      确认删除
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
            </section>
          ) : null}

          {activePage === "stats" ? (
            <section className="space-y-4 rounded-3xl border border-border/70 bg-white/74 p-5 shadow-[0_10px_26px_rgba(106,71,30,0.08)] sm:p-6">
              <h2 className="text-lg font-semibold">统计页</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                <MetricCard icon={<BarChart3 className="h-4 w-4" />} title="总图片" value={String(stats?.total_images ?? 0)} />
                <MetricCard title="总存储" value={formatFileSize(stats?.total_size ?? 0)} />
                <MetricCard title="总浏览" value={String(stats?.total_views ?? 0)} />
                <MetricCard title="总下载" value={String(stats?.total_downloads ?? 0)} />
                <MetricCard title="今日浏览" value={String(stats?.today_views ?? 0)} />
                <MetricCard title="今日上传" value={String(stats?.today_uploads ?? 0)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-border/70 bg-white/80 p-4">
                  <h3 className="mb-3 font-semibold">访问趋势（近 14 天）</h3>
                  <div className="h-72 rounded-xl border border-border/60 bg-muted/25 p-2">
                    {(stats?.daily_stats ?? []).length > 0 ? (
                      <Suspense fallback={<p className="flex h-full items-center justify-center text-sm text-muted-foreground">图表加载中...</p>}>
                        <TrendLineChart data={stats?.daily_stats ?? []} />
                      </Suspense>
                    ) : (
                      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无趋势数据</p>
                    )}
                  </div>
                </article>

                <article className="rounded-2xl border border-border/70 bg-white/80 p-4">
                  <h3 className="mb-3 font-semibold">热门图片 Top 5</h3>
                  <div className="space-y-2">
                    {(stats?.top_images ?? []).length > 0 ? (
                      (stats?.top_images ?? []).map((item, idx) => (
                        <div key={item.short_code} className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                                {idx + 1}
                              </span>
                              <span className="truncate text-xs font-medium" title={item.file_name}>{item.file_name}</span>
                            </div>
                            <span className="text-xs font-semibold text-foreground/85">{item.view_count} 次</span>
                          </div>
                          <p className="mt-1 pl-7 text-[11px] text-muted-foreground">{item.short_code}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无热门图片数据</p>
                    )}
                  </div>
                </article>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <article className="rounded-2xl border border-border/70 bg-white/80 p-4">
                  <h3 className="mb-3 font-semibold">访问来源 Top 5</h3>
                  <div className="space-y-2">
                    {(stats?.top_refers ?? []).length > 0 ? (
                      (stats?.top_refers ?? []).map((item, idx) => (
                        <div key={`${item.referer}-${idx}`} className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-bold text-cyan-700">
                                {idx + 1}
                              </span>
                              <span className="truncate text-xs font-medium" title={item.referer || "直接访问"}>
                                {item.referer || "直接访问"}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-foreground/85">{item.count} 次</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无来源数据</p>
                    )}
                  </div>
                </article>

                <article className="rounded-2xl border border-border/70 bg-white/80 p-4">
                  <h3 className="mb-3 font-semibold">访问 IP Top 5</h3>
                  <div className="space-y-2">
                    {(stats?.top_origins ?? []).length > 0 ? (
                      (stats?.top_origins ?? []).map((item, idx) => (
                        <div key={`${item.origin_ip}-${idx}`} className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[11px] font-bold text-orange-700">
                                {idx + 1}
                              </span>
                              <span className="truncate text-xs font-medium" title={item.origin_ip || "Unknown"}>
                                {item.origin_ip || "Unknown"}
                              </span>
                            </div>
                            <span className="text-xs font-semibold text-foreground/85">{item.count} 次</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">暂无 IP 数据</p>
                    )}
                  </div>
                </article>
              </div>
            </section>
          ) : null}
      </>
    </div>
  );
}

function TabButton({
  current,
  target,
  onClick,
  children,
}: {
  current: ManagePage;
  target: ManagePage;
  onClick: (page: ManagePage) => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant={current === target ? "default" : "outline"}
      size="sm"
      className="rounded-xl"
      onClick={() => onClick(target)}
    >
      {children}
    </Button>
  );
}

function MetricCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-white/72 p-4 shadow-[0_8px_18px_rgba(106,71,30,0.08)]">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 flex items-center gap-2 text-2xl font-semibold">
        {icon}
        {value}
      </p>
    </article>
  );
}

function CopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/60 px-3 py-2">
      <span className="w-[78px] shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground/90" title={value}>
        {value}
      </span>
      <button
        type="button"
        className={
          copied
            ? "rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"
            : "rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-white"
        }
        onClick={onCopy}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}

function MiniCopyRow({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-white/80 p-2">
      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90" title={value}>
          {value}
        </span>
        <button
          type="button"
          className={
            copied
              ? "rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white"
              : "rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white"
          }
          onClick={onCopy}
        >
          {copied ? "已复制" : "复制"}
        </button>
      </div>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/35 px-2 py-1.5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[11px] font-medium text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(2)} ${units[index]}`;
}
