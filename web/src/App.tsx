import { Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BarChart3, Copy, ExternalLink, Github, LogOut, Moon, Shield, Sun, Trash2, Upload } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Toaster } from "@/components/ui/sonner";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CloudPage } from "@/components/cloud-page";
import { SnippetPage } from "@/components/snippet-page";
import { PlyrVideo } from "@/components/plyr-video";
import { PublicErrorPage, PublicPreviewPage, PublicSharePage, PublicSnippetPage, parsePublicPreviewPath, parsePublicSharePath, parsePublicSnippetPath } from "@/components/public-pages";
import {
  ApiError,
  deleteImage,
  getCloudSummary,
  getStats,
  listImages,
  login,
  logout,
  updateAccessMode,
} from "@/lib/api";
import type { AccessMode, ImageListItem, StatsResponse, UploadResultItem } from "@/lib/types";

const PAGE_SIZE = 24;
type GallerySubPage = "upload" | "gallery" | "stats";
type CloudSubPage = "upload" | "files" | "shares" | "stats";
type SnippetSubPage = "editor" | "list" | "shares" | "stats";
type ManageSection = "gallery" | "cloud" | "snippet";
type UploadTaskStatus = "uploading" | "processing" | "success" | "error" | "cancelled";

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

function getGalleryRoute(page: GallerySubPage): string {
  if (page === "upload") {
    return "/gallery/upload";
  }
  if (page === "stats") {
    return "/gallery/stats";
  }
  return "/gallery/index";
}

function getCloudRoute(page: CloudSubPage): string {
  if (page === "upload") {
    return "/cloud/upload";
  }
  if (page === "shares") {
    return "/cloud/shares";
  }
  if (page === "stats") {
    return "/cloud/stats";
  }
  return "/cloud/index";
}

function getSnippetRoute(page: SnippetSubPage): string {
  if (page === "editor") {
    return "/snippets/editor";
  }
  if (page === "shares") {
    return "/snippets/shares";
  }
  if (page === "stats") {
    return "/snippets/stats";
  }
  return "/snippets/index";
}

function resolveGalleryPage(pathname: string): GallerySubPage {
  if (pathname.endsWith("/upload")) {
    return "upload";
  }
  if (pathname.endsWith("/stats")) {
    return "stats";
  }
  return "gallery";
}

function resolveCloudPage(pathname: string): CloudSubPage {
  if (pathname.endsWith("/upload")) {
    return "upload";
  }
  if (pathname.endsWith("/shares") || pathname.endsWith("/share-management")) {
    return "shares";
  }
  if (pathname.endsWith("/stats")) {
    return "stats";
  }
  return "files";
}

function resolveSnippetPage(pathname: string): SnippetSubPage {
  if (pathname.endsWith("/editor")) {
    return "editor";
  }
  if (pathname.endsWith("/shares")) {
    return "shares";
  }
  if (pathname.endsWith("/stats")) {
    return "stats";
  }
  return "list";
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const previewPath = parsePublicPreviewPath(pathname);
  const sharePath = parsePublicSharePath(pathname);
  const snippetSharePath = parsePublicSnippetPath(pathname);
  const isPublicPreviewRoute = Boolean(previewPath);
  const isPublicShareRoute = Boolean(sharePath);
  const isPublicSnippetRoute = Boolean(snippetSharePath);
  const isPublicErrorRoute = pathname === "/gallery/error";
  const isLoginRoute = pathname === "/login";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ManageSection>("gallery");
  const [activeGalleryPage, setActiveGalleryPage] = useState<GallerySubPage>("upload");
  const [activeCloudPage, setActiveCloudPage] = useState<CloudSubPage>("upload");
  const [activeSnippetPage, setActiveSnippetPage] = useState<SnippetSubPage>("editor");
  const [busy, setBusy] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [githubStars, setGithubStars] = useState<number | null>(null);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [items, setItems] = useState<ImageListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [fileType, setFileType] = useState("all");

  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [gallerySelectedFiles, setGallerySelectedFiles] = useState<File[]>([]);
  const [galleryDropActive, setGalleryDropActive] = useState(false);
  const [selectedFilesLabel, setSelectedFilesLabel] = useState("未选择文件");
  const [copiedKey, setCopiedKey] = useState("");
  const [previewItem, setPreviewItem] = useState<ImageListItem | null>(null);
  const [accessModalItem, setAccessModalItem] = useState<ImageListItem | null>(null);
  const [accessModalMode, setAccessModalMode] = useState<AccessMode>("none");
  const [accessModalPassword, setAccessModalPassword] = useState("");
  const [accessModalKeepExisting, setAccessModalKeepExisting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageListItem | null>(null);
  const activeUploadsRef = useRef<Record<string, XMLHttpRequest>>({});

  const pageCount = useMemo(() => Math.max(Math.ceil(total / PAGE_SIZE), 1), [total]);
  const activeBrand = activeSection === "cloud" ? "Z-Drive Cloud" : activeSection === "snippet" ? "Z-Drive Snippet" : "Z-Drive Gallery";

  useEffect(() => {
    if (isPublicPreviewRoute || isPublicShareRoute || isPublicSnippetRoute || isPublicErrorRoute) {
      return;
    }

    if (pathname === "/gallery") {
      navigate("/gallery/index", { replace: true });
      return;
    }

    if (pathname === "/cloud") {
      navigate("/cloud/index", { replace: true });
      return;
    }

    if (pathname === "/snippets") {
      navigate("/snippets/editor", { replace: true });
      return;
    }

    if (pathname === "/cloud/share-management") {
      navigate("/cloud/shares", { replace: true });
      return;
    }

    if ((pathname.startsWith("/gallery") || pathname.startsWith("/cloud") || pathname.startsWith("/snippets")) && !authLoading && !isAuthed) {
      navigate("/login", { replace: true });
      return;
    }

    if (pathname === "/") {
      if (!authLoading) {
        navigate(isAuthed ? "/gallery/index" : "/login", { replace: true });
      }
      return;
    }

    if (pathname === "/login" && isAuthed) {
      navigate("/gallery/index", { replace: true });
    }
  }, [authLoading, isAuthed, isPublicErrorRoute, isPublicPreviewRoute, isPublicShareRoute, isPublicSnippetRoute, navigate, pathname]);

  useEffect(() => {
    if (pathname.startsWith("/gallery")) {
      setActiveSection("gallery");
      setActiveGalleryPage(resolveGalleryPage(pathname));
      return;
    }

    if (pathname.startsWith("/cloud")) {
      setActiveSection("cloud");
      setActiveCloudPage(resolveCloudPage(pathname));
      return;
    }

    if (pathname.startsWith("/snippets")) {
      setActiveSection("snippet");
      setActiveSnippetPage(resolveSnippetPage(pathname));
    }
  }, [pathname]);

  useEffect(() => {
    if (isPublicPreviewRoute || isPublicShareRoute || isPublicSnippetRoute || isPublicErrorRoute) {
      document.documentElement.classList.remove("dark");
      setIsDark(false);
      return;
    }
    const stored = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    const shouldDark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", shouldDark);
    setIsDark(shouldDark);
  }, [isPublicErrorRoute, isPublicPreviewRoute, isPublicShareRoute, isPublicSnippetRoute]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("https://api.github.com/repos/ThinkerWen/z-drive", {
          signal: controller.signal,
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!response.ok) return;
        const data = await response.json() as { stargazers_count?: number };
        if (typeof data.stargazers_count === "number") {
          setGithubStars(data.stargazers_count);
        }
      } catch {
        // 获取失败则保持 null，不显示 star 数
      }
    })();
    return () => controller.abort();
  }, []);

  function toggleTheme() {
    const nextIsDark = !isDark;
    document.documentElement.classList.toggle("dark", nextIsDark);
    window.localStorage.setItem("theme", nextIsDark ? "dark" : "light");
    setIsDark(nextIsDark);
  }

  function notify(text: string) {
    const normalized = text.trim().toLowerCase();
    const errorPattern = /失败|错误|异常|无效|失效|拒绝|不存在|未找到|超时|error|failed|exception|invalid|forbidden|unauthorized|not\s*found|timeout|500|404|403|401/i;
    const isError = errorPattern.test(normalized);
    if (isError) {
      toast.error(text);
    } else {
      toast.success(text);
    }
  }

  function notifySuccess(text: string) {
    toast.success(text);
  }

  function notifyError(text: string) {
    toast.error(text);
  }

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
        notifyError("请先登录管理账号");
        return;
      }
      notifyError(error instanceof Error ? error.message : "加载失败");
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
        setActiveSection("gallery");
        setActiveGalleryPage("gallery");
        navigate("/login", { replace: true });
        notifyError("请先登录管理账号");
        return;
      }
      notifyError(error instanceof Error ? error.message : "统计加载失败");
    }
  }

  useEffect(() => {
    if (isPublicPreviewRoute || isPublicShareRoute || isPublicSnippetRoute || isPublicErrorRoute || isLoginRoute) {
      setAuthLoading(false);
      return;
    }
    void (async () => {
      setAuthLoading(true);
      if (pathname.startsWith("/cloud") || pathname.startsWith("/snippets")) {
        try {
          if (pathname.startsWith("/cloud")) {
            await getCloudSummary();
          } else {
            await listImages({ page: 1, pageSize: 1, query: "", fileType: "all" });
          }
          setIsAuthed(true);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            setIsAuthed(false);
            navigate("/login", { replace: true });
            notifyError("请先登录管理账号");
          } else {
            notifyError(error instanceof Error ? error.message : "认证检查失败");
          }
        }
      } else {
        await Promise.all([refreshStats(), refreshList(1)]);
      }
      setAuthLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoginRoute, isPublicErrorRoute, isPublicPreviewRoute, isPublicShareRoute, isPublicSnippetRoute, pathname]);

  if (isPublicPreviewRoute && previewPath) {
    return <PublicPreviewPage shortCode={previewPath.shortCode} ext={previewPath.ext} />;
  }

  if (isPublicShareRoute && sharePath) {
    return <PublicSharePage shareCode={sharePath.shareCode} />;
  }

  if (isPublicSnippetRoute && snippetSharePath) {
    return <PublicSnippetPage shareCode={snippetSharePath.shareCode} />;
  }

  if (isPublicErrorRoute) {
    return <PublicErrorPage />;
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await login(username, password);
      setPassword("");
      await Promise.all([refreshStats(), refreshList(1)]);
      setActiveSection("gallery");
      setActiveGalleryPage("gallery");
      navigate("/gallery/index", { replace: true });
      notifySuccess("登录成功");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "登录失败");
    } finally {
      setBusy(false);
    }
  }

  async function runGalleryUpload(files: File[]) {
    if (files.length === 0) {
      notifyError("请选择至少一个文件");
      return;
    }

    setBusy(true);
    try {
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
      if (successCount > 0) {
        notifySuccess(`上传完成：成功 ${successCount} / ${tasks.length}`);
      } else {
        notifyError(`上传完成：成功 ${successCount} / ${tasks.length}`);
      }

      setGallerySelectedFiles([]);
      setSelectedFilesLabel("未选择文件");
      await Promise.all([refreshStats(), refreshList(1)]);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runGalleryUpload(gallerySelectedFiles);
  }

  function updateTask(id: string, updater: (task: UploadTask) => UploadTask) {
    setUploadTasks((prev) => prev.map((task) => (task.id === id ? updater(task) : task)));
  }

  async function uploadFileTask(taskId: string, file: File): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/gallery/api/upload", true);
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

        const payloadObj = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
        const isEnvelope =
          payloadObj !== null &&
          "code" in payloadObj &&
          "data" in payloadObj &&
          "message" in payloadObj;

        const envelopeCode =
          isEnvelope && typeof payloadObj.code === "number"
            ? payloadObj.code
            : null;

        const envelopeMessage =
          isEnvelope && typeof payloadObj.message === "string"
            ? payloadObj.message
            : "";

        const dataPayload =
          isEnvelope && payloadObj.data && typeof payloadObj.data === "object"
            ? (payloadObj.data as Record<string, unknown>)
            : !isEnvelope
              ? payloadObj
              : null;

        if (
          xhr.status < 200 ||
          xhr.status >= 300 ||
          !payload ||
          (envelopeCode !== null && envelopeCode !== 0) ||
          !dataPayload
        ) {
          const detail =
            envelopeMessage ||
            (typeof payload?.detail === "string" ? payload.detail : "上传失败");
          updateTask(taskId, (task) => ({ ...task, status: "error", error: detail }));
          reject(new Error(detail));
          return;
        }

        const successResult: UploadResultItem = {
          file_name: String(dataPayload.file_name ?? file.name),
          file_size: Number(dataPayload.file_size ?? file.size),
          file_type: String(dataPayload.file_type ?? file.type.split("/")[0] ?? "file"),
          success: true,
          short_code: String(dataPayload.short_code ?? ""),
          view_url: typeof dataPayload.view_url === "string" ? dataPayload.view_url : undefined,
          direct_url: typeof dataPayload.direct_url === "string" ? dataPayload.direct_url : undefined,
          preview_url: typeof dataPayload.preview_url === "string" ? dataPayload.preview_url : undefined,
          sign: typeof dataPayload.sign === "string" ? dataPayload.sign : undefined,
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
      setGallerySelectedFiles([]);
      setSelectedFilesLabel("未选择文件");
      return;
    }
    const files = Array.from(fileList);
    setGallerySelectedFiles(files);
    if (fileList.length === 1) {
      setSelectedFilesLabel(fileList[0].name);
      return;
    }
    setSelectedFilesLabel(`已选择 ${fileList.length} 个文件`);
  }

  async function handleGalleryDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setGalleryDropActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length === 0) {
      return;
    }
    setGallerySelectedFiles(files);
    setSelectedFilesLabel(files.length === 1 ? files[0].name : `已选择 ${files.length} 个文件`);
    await runGalleryUpload(files);
  }

  function fallbackCopyWithExecCommand(value: string): boolean {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "readonly");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, textArea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      document.body.removeChild(textArea);
    }
    return copied;
  }

  async function copyText(value: string, key: string) {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else if (!fallbackCopyWithExecCommand(value)) {
        throw new Error("clipboard unavailable");
      }
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(""), 1500);
    } catch {
      if (fallbackCopyWithExecCommand(value)) {
        setCopiedKey(key);
        window.setTimeout(() => setCopiedKey(""), 1500);
        return;
      }
      window.prompt("当前环境不支持自动复制，请手动复制以下内容：", value);
      notifyError("自动复制失败，已提供手动复制");
    }
  }

  async function handleDelete(shortCode: string) {
    setBusy(true);
    try {
      await deleteImage(shortCode);
      await Promise.all([refreshStats(), refreshList(page)]);
      notifySuccess("删除成功");
      setDeleteTarget(null);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccessModeChange(item: ImageListItem, nextMode: AccessMode) {
    setBusy(true);
    try {
      await updateAccessMode(item.short_code, nextMode);
      await refreshList(page);
      notifySuccess("访问模式已更新");
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "更新失败");
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
      notifySuccess("访问模式已更新");
      setAccessModalItem(null);
    } catch (error) {
      notifyError(error instanceof Error ? error.message : "更新失败");
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
    setActiveSection("gallery");
    setActiveGalleryPage("gallery");
    setStats(null);
    setItems([]);
    setTotal(0);
    navigate("/login", { replace: true });
    notifySuccess("已退出登录");
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  const isLoginView = isLoginRoute || !isAuthed;

  if (isLoginView) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-4 py-8 sm:px-8">
        <section className="w-full max-w-md rounded-lg border bg-card p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/90">Z-Drive Gallery</p>
          <h2 className="mt-3 text-2xl font-semibold">管理员登录</h2>
          <p className="mt-1 text-sm text-muted-foreground">请输入管理凭据后进入工作台。</p>
          <form className="mt-5 space-y-3" onSubmit={handleLogin}>
            <Field className="gap-1">
              <FieldLabel htmlFor="login-username">用户名</FieldLabel>
              <Input
                id="login-username"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field className="gap-1">
              <FieldLabel htmlFor="login-password">密码</FieldLabel>
              <Input
                id="login-password"
                type="password"
                placeholder="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button className="w-full" disabled={busy}>
              {busy ? "登录中..." : "登录"}
            </Button>
          </form>
        </section>
        <Toaster />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-50 flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
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
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="group/toggle extend-touch-target size-8"
                onClick={toggleTheme}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                  <path d="M12 3l0 18" />
                  <path d="M12 9l4.65 -4.65" />
                  <path d="M12 14.3l7.37 -7.37" />
                  <path d="M12 19.6l8.85 -8.85" />
                </svg>
                <span className="sr-only">Toggle theme</span>
              </Button>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 rounded-md px-3 shadow-none" asChild>
                <a href="https://github.com/ThinkerWen/z-drive" target="_blank" rel="noreferrer">
                  <Github className="size-4" />
                  {githubStars !== null ? (
                    <span className="w-fit text-xs text-muted-foreground tabular-nums">
                      {githubStars >= 1000 ? `${(githubStars / 1000).toFixed(1)}k` : githubStars}
                    </span>
                  ) : null}
                </a>
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleLogout()} disabled={busy} title="退出">
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ) : null}
        </header>

        <main className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex-1 space-y-4">
          {activeSection === "gallery" && activeGalleryPage === "upload" ? (
            <section className="rounded-lg border bg-card p-5 sm:p-6">
            <h2 className="mb-3 flex items-center text-lg font-semibold">
              <Upload className="mr-2 h-5 w-5" /> 上传页
            </h2>
            <form className="space-y-3" onSubmit={handleUpload}>
              <Input
                id="upload-files"
                name="files"
                type="file"
                multiple
                className="sr-only"
                onChange={handleFileInputChange}
              />
              <label
                htmlFor="upload-files"
                className={
                  galleryDropActive
                    ? "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-primary bg-primary/5 px-4 py-8 text-center"
                    : "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted px-4 py-8 text-center transition hover:border-primary/70 hover:bg-card"
                }
                onDragOver={(event) => {
                  event.preventDefault();
                  setGalleryDropActive(true);
                }}
                onDragLeave={() => setGalleryDropActive(false)}
                onDrop={(event) => {
                  void handleGalleryDrop(event);
                }}
              >
                <p className="text-base font-semibold">拖拽文件到这里上传</p>
                <p className="mt-1 text-sm text-muted-foreground">或点击此区域选择文件，可一次上传多个文件</p>
                <p className="mt-3 max-w-full truncate rounded-lg bg-card px-3 py-1.5 text-xs text-muted-foreground" title={selectedFilesLabel}>
                  {selectedFilesLabel}
                </p>
              </label>
              <div className="flex justify-end">
                <Button disabled={busy || gallerySelectedFiles.length === 0}>{busy ? "上传中..." : "开始上传"}</Button>
              </div>
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
                      className="rounded-lg border bg-card p-4"
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

                        <Badge
                          variant={
                            task.status === "success"
                              ? "default"
                              : task.status === "cancelled"
                                ? "secondary"
                                : task.status === "processing" || task.status === "uploading"
                                  ? "secondary"
                              : "destructive"
                          }
                          className="text-xs"
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
                        </Badge>
                        {task.status === "uploading" || task.status === "processing" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => cancelUpload(task.id)}
                          >
                            取消
                          </Button>
                        ) : null}
                      </div>

                      {(task.status === "uploading" || task.status === "processing") ? (
                        <Progress value={task.progress} className="mt-3 h-1.5" />
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
              <div className="mt-4 rounded-lg border border-dashed bg-muted/50 px-4 py-6 text-center text-sm text-muted-foreground">
                暂无上传记录
              </div>
            )}
            </section>
          ) : null}

          {activeSection === "gallery" && activeGalleryPage === "gallery" ? (
            <section className="rounded-lg border bg-card p-5 sm:p-6">
            <h2 className="mb-3 text-lg font-semibold">图库页</h2>
            <form className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted p-3" onSubmit={applyFilters}>
              <Select
                value={fileType}
                onValueChange={(value) => {
                  setFileType(value);
                  void refreshList(1, query, value);
                }}
              >
                <SelectTrigger className="w-full max-w-48">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>文件类型</SelectLabel>
                    <SelectItem value="all">全部类型</SelectItem>
                    <SelectItem value="image">图片</SelectItem>
                    <SelectItem value="video">视频</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Field className="min-w-64 flex-1 gap-0">
                <FieldLabel htmlFor="gallery-search" className="sr-only">搜索文件名或短码</FieldLabel>
                <Input
                  id="gallery-search"
                  placeholder="搜索文件名或短码"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </Field>
              <Button disabled={busy}>查询</Button>
            </form>

            {items.length > 0 ? (
              <div className="grid grid-cols-4 gap-2 md:grid-cols-6 xl:grid-cols-8">
                {items.map((item) => (
                  <article key={item.id} className="group overflow-hidden rounded-lg bg-card p-1.5 transition">
                    <div
                      className="aspect-square cursor-pointer overflow-hidden rounded-md bg-muted"
                      onClick={() => setPreviewItem(item)}
                    >
                      {item.file_type === "video" ? (
                        <video src={item.view_url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={item.view_url} alt={item.file_name} className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="space-y-1 p-1">
                      <p className="truncate text-xs font-semibold" title={item.file_name}>{item.file_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatFileSize(item.file_size)} · {item.width}x{item.height} · 浏览 {item.view_count}
                      </p>
                      <div className="flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 flex-1 px-1.5 text-[10px]"
                          onClick={() => void copyText(buildSignedShortLink(item), `short-${item.short_code}`)}
                        >
                          <Copy className="mr-0.5 h-3 w-3" />
                          {copiedKey === `short-${item.short_code}` ? "已复制" : "短链"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 flex-1 px-1.5 text-[10px]" onClick={() => openPreviewPage(item)}>
                          <ExternalLink className="mr-0.5 h-3 w-3" /> 预览
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 flex-1 px-1.5 text-[10px]"
                          onClick={() => openAccessModeModal(item)}
                        >
                          <Shield className="mr-0.5 h-3 w-3" /> 访问
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 flex-1 px-1.5 text-[10px]"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="mr-0.5 h-3 w-3" /> 删除
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed bg-muted/50 px-4 py-10 text-center text-sm text-muted-foreground">
                暂无符合条件的文件
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">共 {total} 条</p>
              <Pagination className="w-auto">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => { if (page > 1) void refreshList(page - 1); }}
                      className={page <= 1 || busy ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: pageCount }, (_, i) => i + 1).slice(
                    Math.max(0, page - 3),
                    Math.min(pageCount, page + 2)
                  ).map((p) => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => { if (p !== page) void refreshList(p); }}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => { if (page < pageCount) void refreshList(page + 1); }}
                      className={page >= pageCount || busy ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
            <Dialog open={Boolean(previewItem)} onOpenChange={() => setPreviewItem(null)}>
              <DialogContent className="max-w-4xl">
                <DialogHeader>
                  <DialogTitle className="truncate">{previewItem?.file_name}</DialogTitle>
                  <DialogDescription>点击遮罩可关闭预览</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                  <div className="flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg border bg-muted/60">
                    {previewItem?.file_type === "video" ? (
                      <PlyrVideo src={previewItem.view_url} className="max-h-[70vh] w-full" />
                    ) : (
                      <img src={previewItem?.view_url} alt={previewItem?.file_name} className="max-h-[70vh] w-auto" />
                    )}
                  </div>
                  <aside className="space-y-3">
                    <div className="rounded-lg border bg-muted/45 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">链接</p>
                      <div className="space-y-2">
                        <MiniCopyRow
                          label="短链接"
                          value={previewItem ? buildSignedShortLink(previewItem) : ""}
                          copied={previewItem ? copiedKey === `preview-short-${previewItem.short_code}` : false}
                          onCopy={() => previewItem ? void copyText(buildSignedShortLink(previewItem), `preview-short-${previewItem.short_code}`) : undefined}
                        />
                        <MiniCopyRow
                          label="快速预览"
                          value={previewItem?.preview_url || previewItem?.view_url || ""}
                          copied={previewItem ? copiedKey === `preview-quick-${previewItem.short_code}` : false}
                          onCopy={() => previewItem ? void copyText(previewItem.preview_url || previewItem.view_url, `preview-quick-${previewItem.short_code}`) : undefined}
                        />
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">基础信息</p>
                      <dl className="grid grid-cols-2 gap-2 text-xs">
                        <InfoCell label="短码" value={previewItem?.short_code ?? ""} />
                        <InfoCell label="类型" value={previewItem?.file_type ?? ""} />
                        <InfoCell label="MIME" value={previewItem?.mime_type ?? ""} />
                        <InfoCell label="尺寸" value={previewItem ? `${previewItem.width} x ${previewItem.height}` : ""} />
                        <InfoCell label="浏览" value={String(previewItem?.view_count ?? 0)} />
                        <InfoCell label="下载" value={String(previewItem?.download_count ?? 0)} />
                      </dl>
                    </div>
                    <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">创建时间</p>
                      <p className="mt-1">{previewItem?.created_at}</p>
                    </div>
                  </aside>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={Boolean(accessModalItem)} onOpenChange={() => setAccessModalItem(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>设置访问模式</DialogTitle>
                  <DialogDescription>文件: {accessModalItem?.file_name}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className={
                      `h-auto w-full flex-col items-start gap-1 px-3 py-3 text-left ${
                        accessModalMode === "none"
                          ? "border-2 border-primary bg-primary/5"
                          : "border"
                      }`
                    }
                    onClick={() => {
                      setAccessModalMode("none");
                      setAccessModalKeepExisting(false);
                    }}
                  >
                    <p className="text-sm font-semibold">公开访问</p>
                    <p className="mt-1 text-xs text-muted-foreground">任何人都可以访问此文件</p>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className={
                      `h-auto w-full flex-col items-start gap-1 px-3 py-3 text-left ${
                        accessModalMode === "individual"
                          ? "border-2 border-primary bg-primary/5"
                          : "border"
                      }`
                    }
                    onClick={() => setAccessModalMode("individual")}
                  >
                    <p className="text-sm font-semibold">独立验证</p>
                    <p className="mt-1 text-xs text-muted-foreground">为该文件设置独立访问密码</p>
                    {accessModalMode === "individual" ? (
                      <div className="mt-3 rounded-lg border bg-muted/40 p-3">
                        <p className="text-[11px] font-semibold text-muted-foreground">访问密码</p>
                        <p className="mt-1 truncate rounded bg-white px-2 py-1 font-mono text-xs" title={accessModalPassword || (accessModalKeepExisting ? "****** (已设置)" : "")}>
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
                  </Button>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAccessModalItem(null)} disabled={busy}>取消</Button>
                  <Button type="button" onClick={() => void saveAccessMode()} disabled={busy}>保存</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>删除确认</DialogTitle>
                  <DialogDescription>
                    确定要删除 {deleteTarget?.file_name} 吗？此操作不可恢复。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>取消</Button>
                  <Button type="button" variant="destructive" onClick={() => { if (deleteTarget) void handleDelete(deleteTarget.short_code); }} disabled={busy}>确认删除</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </section>
          ) : null}

          {activeSection === "gallery" && activeGalleryPage === "stats" ? (
            <section className="space-y-4 rounded-lg border bg-card p-5 sm:p-6">
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
                <article className="rounded-lg border bg-card p-4">
                  <h3 className="mb-3 font-semibold">访问趋势（近 14 天）</h3>
                  <div className="h-72 rounded-lg border bg-muted/25 p-2">
                    {(stats?.daily_stats ?? []).length > 0 ? (
                      <Suspense fallback={<div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner /> 图表加载中...</div>}>
                        <TrendLineChart data={stats?.daily_stats ?? []} />
                      </Suspense>
                    ) : (
                      <p className="flex h-full items-center justify-center text-sm text-muted-foreground">暂无趋势数据</p>
                    )}
                  </div>
                </article>

                <article className="rounded-lg border bg-card p-4">
                  <h3 className="mb-3 font-semibold">热门图片 Top 5</h3>
                  <div className="space-y-2">
                    {(stats?.top_images ?? []).length > 0 ? (
                      (stats?.top_images ?? []).map((item, idx) => (
                        <div key={item.short_code} className="rounded-lg border bg-muted/35 px-3 py-2">
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
                <article className="rounded-lg border bg-card p-4">
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

                <article className="rounded-lg border bg-card p-4">
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

          {activeSection === "cloud" ? (
            <CloudPage
              mode={activeCloudPage}
              onAuthExpired={() => {
                setIsAuthed(false);
                setActiveSection("gallery");
                setActiveGalleryPage("gallery");
                navigate("/login", { replace: true });
                notifyError("登录已过期，请重新登录");
              }}
              onNotify={notify}
            />
          ) : null}

          {activeSection === "snippet" ? (
            <SnippetPage
              mode={activeSnippetPage}
              onAuthExpired={() => {
                setIsAuthed(false);
                setActiveSection("gallery");
                setActiveGalleryPage("gallery");
                navigate("/login", { replace: true });
                notifyError("登录已过期，请重新登录");
              }}
              onNotify={notify}
            />
          ) : null}
      </div>
      </main>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}

function TabButton<T extends string>({
  current,
  target,
  onClick,
  children,
}: {
  current: T;
  target: T;
  onClick: (page: T) => void;
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
    <article className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 flex items-center gap-2 text-2xl font-bold">
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
      <Button
        type="button"
        size="sm"
        className={
          copied
            ? "h-7 bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-600"
            : "h-7 px-2.5 text-xs font-semibold"
        }
        onClick={onCopy}
      >
        {copied ? "已复制" : "复制"}
      </Button>
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
    <div className="rounded-xl border border-border/70 bg-card p-2">
      <p className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/90" title={value}>
          {value}
        </span>
        <Button
          type="button"
          size="sm"
          className={
            copied
              ? "h-6 w-14 shrink-0 bg-emerald-600 px-2 text-[11px] font-semibold text-white hover:bg-emerald-600"
              : "h-6 w-14 shrink-0 px-2 text-[11px] font-semibold"
          }
          onClick={onCopy}
        >
          {copied ? "已复制" : "复制"}
        </Button>
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

