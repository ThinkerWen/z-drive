import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  File,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Image,
  Music,
  Package,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Upload,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlyrVideo } from "@/components/plyr-video";
import {
  batchCopyCloudItems,
  batchDeleteCloudItems,
  batchMoveCloudItems,
  ApiError,
  cancelCloudShare,
  copyCloudItem,
  createCloudFolder,
  createCloudShare,
  deleteCloudItem,
  getCloudSummary,
  listCloudItems,
  listCloudShares,
  moveCloudItem,
  renameCloudItem,
  uploadCloudFiles,
} from "@/lib/api";
import type {
  CloudFileType,
  CloudItem,
  CloudShareResponse,
  CloudSortBy,
  CloudSortOrder,
  CloudSummaryResponse,
} from "@/lib/types";

interface CloudPageProps {
  mode: "upload" | "files" | "shares" | "stats";
  onAuthExpired: () => void;
  onNotify: (message: string) => void;
}

type TargetPickerAction =
  | { mode: "move"; scope: "single"; item: CloudItem }
  | { mode: "copy"; scope: "single"; item: CloudItem }
  | { mode: "move"; scope: "batch" }
  | { mode: "copy"; scope: "batch" };

const ROOT_NODE = { id: null as number | null, name: "根目录" };

export function CloudPage({ mode, onAuthExpired, onNotify }: CloudPageProps) {
  const [items, setItems] = useState<CloudItem[]>([]);
  const [summary, setSummary] = useState<CloudSummaryResponse | null>(null);
  const [shares, setShares] = useState<CloudShareResponse[]>([]);
  const [currentParentId, setCurrentParentId] = useState<number | null>(null);
  const [pathNodes, setPathNodes] = useState<Array<{ id: number | null; name: string }>>([ROOT_NODE]);

  const [query, setQuery] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [sortBy, setSortBy] = useState<CloudSortBy>("name");
  const [order, setOrder] = useState<CloudSortOrder>("asc");
  const [sortOption, setSortOption] = useState<"name-asc" | "name-desc" | "time-asc" | "time-desc" | "size-asc" | "size-desc">("name-asc");
  const [fileType, setFileType] = useState<CloudFileType>("all");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadDropActive, setUploadDropActive] = useState(false);
  const [copiedShareId, setCopiedShareId] = useState<number | null>(null);
  const [sharePasswords, setSharePasswords] = useState<Record<string, string>>({});
  const [copyPasswordShare, setCopyPasswordShare] = useState<CloudShareResponse | null>(null);
  const [copyPasswordInput, setCopyPasswordInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchActionMenuOpen, setBatchActionMenuOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [targetPickerAction, setTargetPickerAction] = useState<TargetPickerAction | null>(null);
  const [targetPickerPathNodes, setTargetPickerPathNodes] = useState<Array<{ id: number | null; name: string }>>([ROOT_NODE]);
  const [targetPickerFolders, setTargetPickerFolders] = useState<CloudItem[]>([]);
  const [targetPickerLoading, setTargetPickerLoading] = useState(false);
  const [targetPickerSubmitting, setTargetPickerSubmitting] = useState(false);
  const [targetPickerCopyName, setTargetPickerCopyName] = useState("");
  const [propertiesItem, setPropertiesItem] = useState<CloudItem | null>(null);
  const [previewItem, setPreviewItem] = useState<CloudItem | null>(null);
  const [renameModalItem, setRenameModalItem] = useState<CloudItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareModalItem, setShareModalItem] = useState<CloudItem | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpiresMinutes, setShareExpiresMinutes] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    item: CloudItem;
    x: number;
    y: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("z-drive-cloud-share-passwords") || "{}";
      const payload = JSON.parse(raw) as Record<string, string>;
      setSharePasswords(payload);
    } catch {
      setSharePasswords({});
    }
  }, []);

  function saveSharePasswords(next: Record<string, string>) {
    setSharePasswords(next);
    localStorage.setItem("z-drive-cloud-share-passwords", JSON.stringify(next));
  }

  const usagePercent = useMemo(() => {
    if (!summary || summary.total_space <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((summary.total_size / summary.total_space) * 100));
  }, [summary]);

  async function refreshItems(
    parentId = currentParentId,
    nextQuery = query,
    nextSortBy = sortBy,
    nextOrder = order,
    nextFileType = fileType,
  ) {
    try {
      const listData = await listCloudItems({
        parentId,
        query: nextQuery,
        sortBy: nextSortBy,
        order: nextOrder,
        fileType: nextFileType,
      });
      setItems(listData.items);
      setSelectedIds([]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "云盘列表加载失败");
    }
  }

  async function refreshSummaryAndShares() {
    try {
      const [summaryData, shareData] = await Promise.all([getCloudSummary(), listCloudShares()]);
      setSummary(summaryData);
      setShares(shareData);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "云盘统计加载失败");
    }
  }

  async function refreshAll(parentId = currentParentId) {
    setLoading(true);
    await Promise.all([refreshItems(parentId), refreshSummaryAndShares()]);
    setLoading(false);
  }

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const handleGlobalClose = () => {
      setContextMenu(null);
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
      }
    };

    window.addEventListener("click", handleGlobalClose);
    window.addEventListener("scroll", handleGlobalClose, true);
    window.addEventListener("resize", handleGlobalClose);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("click", handleGlobalClose);
      window.removeEventListener("scroll", handleGlobalClose, true);
      window.removeEventListener("resize", handleGlobalClose);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [contextMenu]);

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

  async function copyText(value: string, shareId: number) {
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else if (!fallbackCopyWithExecCommand(value)) {
        throw new Error("clipboard unavailable");
      }
      setCopiedShareId(shareId);
      window.setTimeout(() => setCopiedShareId(null), 1500);
    } catch {
      if (fallbackCopyWithExecCommand(value)) {
        setCopiedShareId(shareId);
        window.setTimeout(() => setCopiedShareId(null), 1500);
        return;
      }
      window.prompt("当前环境不支持自动复制，请手动复制以下内容：", value);
      onNotify("自动复制失败，已提供手动复制");
    }
  }

  function enterFolder(item: CloudItem) {
    if (!item.is_folder) {
      return;
    }
    setCurrentParentId(item.id);
    setPathNodes((prev) => [...prev, { id: item.id, name: item.name }]);
    void refreshAll(item.id);
  }

  function parseSortOption(value: string): { sortBy: CloudSortBy; order: CloudSortOrder } {
    const [sortField, sortOrder] = value.split("-");
    const mappedSortBy: CloudSortBy = sortField === "time" || sortField === "size" ? sortField : "name";
    const mappedOrder: CloudSortOrder = sortOrder === "desc" ? "desc" : "asc";
    return { sortBy: mappedSortBy, order: mappedOrder };
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(queryInput);
    await refreshItems(currentParentId, queryInput, sortBy, order, fileType);
  }

  async function handleSortChange(nextOption: string) {
    const { sortBy: nextSortBy, order: nextOrder } = parseSortOption(nextOption);
    setSortOption(nextOption as "name-asc" | "name-desc" | "time-asc" | "time-desc" | "size-asc" | "size-desc");
    setSortBy(nextSortBy);
    setOrder(nextOrder);
    await refreshItems(currentParentId, query, nextSortBy, nextOrder, fileType);
  }

  function jumpToPath(index: number) {
    const nextNode = pathNodes[index];
    if (!nextNode) {
      return;
    }
    const nextPath = pathNodes.slice(0, index + 1);
    setPathNodes(nextPath);
    setCurrentParentId(nextNode.id);
    void refreshAll(nextNode.id);
  }

  function goToParentLevel() {
    if (pathNodes.length <= 1) {
      return;
    }
    jumpToPath(pathNodes.length - 2);
  }

  async function handleCreateFolder() {
    const raw = window.prompt("输入新建文件夹名称", "新建文件夹");
    if (raw === null) {
      return;
    }
    const name = raw.trim();
    if (!name) {
      onNotify("请输入目录名");
      return;
    }
    setLoading(true);
    try {
      await createCloudFolder(currentParentId, name);
      onNotify("目录创建成功");
      await refreshAll(currentParentId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "目录创建失败");
    } finally {
      setLoading(false);
    }
  }

  function handleCreateFile() {
    onNotify("暂不支持直接新建空文件，请使用上传功能创建文件");
  }

  async function uploadCloudFileList(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setUploading(true);
    try {
      await uploadCloudFiles(currentParentId, files);
      onNotify(`上传完成，共 ${files.length} 个文件`);
      await refreshAll(currentParentId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    await uploadCloudFileList(files);
    event.target.value = "";
  }

  async function handleUploadDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setUploadDropActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    await uploadCloudFileList(files);
  }

  function openRenameModal(item: CloudItem) {
    setRenameModalItem(item);
    setRenameValue(item.name);
  }

  async function submitRename() {
    if (!renameModalItem) {
      return;
    }
    const nextName = renameValue.trim();
    if (!nextName || nextName === renameModalItem.name) {
      return;
    }
    setLoading(true);
    try {
      await renameCloudItem(renameModalItem.id, nextName);
      onNotify("重命名成功");
      setRenameModalItem(null);
      await refreshAll(currentParentId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "重命名失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(item: CloudItem) {
    const ok = window.confirm(`确认删除 ${item.name} 吗？此操作不可恢复。`);
    if (!ok) {
      return;
    }
    setLoading(true);
    try {
      await deleteCloudItem(item.id);
      onNotify("删除成功");
      await refreshAll(currentParentId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "删除失败");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(itemId: number) {
    setSelectedIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      return [...prev, itemId];
    });
  }

  function toggleSelectAllCurrent() {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(items.map((item) => item.id));
  }

  async function loadTargetPickerFolders(parentId: number | null) {
    setTargetPickerLoading(true);
    try {
      const listData = await listCloudItems({
        parentId,
        query: "",
        sortBy: "name",
        order: "asc",
        fileType: "all",
      });
      setTargetPickerFolders(listData.items.filter((item) => item.is_folder));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "目录加载失败");
    } finally {
      setTargetPickerLoading(false);
    }
  }

  async function openTargetPicker(action: TargetPickerAction) {
    setTargetPickerAction(action);
    setTargetPickerPathNodes([ROOT_NODE]);
    setTargetPickerCopyName(action.mode === "copy" && action.scope === "single" ? action.item.name : "");
    await loadTargetPickerFolders(null);
  }

  async function jumpTargetPickerPath(index: number) {
    const nextNode = targetPickerPathNodes[index];
    if (!nextNode) {
      return;
    }
    const nextPath = targetPickerPathNodes.slice(0, index + 1);
    setTargetPickerPathNodes(nextPath);
    await loadTargetPickerFolders(nextNode.id);
  }

  async function enterTargetPickerFolder(item: CloudItem) {
    if (!item.is_folder) {
      return;
    }
    const nextPath = [...targetPickerPathNodes, { id: item.id, name: item.name }];
    setTargetPickerPathNodes(nextPath);
    await loadTargetPickerFolders(item.id);
  }

  async function goTargetPickerParent() {
    if (targetPickerPathNodes.length <= 1) {
      return;
    }
    await jumpTargetPickerPath(targetPickerPathNodes.length - 2);
  }

  function closeTargetPicker() {
    if (targetPickerSubmitting) {
      return;
    }
    setTargetPickerAction(null);
    setTargetPickerPathNodes([ROOT_NODE]);
    setTargetPickerFolders([]);
    setTargetPickerCopyName("");
  }

  async function confirmTargetPickerAction() {
    if (!targetPickerAction) {
      return;
    }

    const targetParentId = targetPickerPathNodes[targetPickerPathNodes.length - 1]?.id ?? null;

    setTargetPickerSubmitting(true);
    setLoading(true);
    try {
      if (targetPickerAction.scope === "single" && targetPickerAction.mode === "move") {
        await moveCloudItem(targetPickerAction.item.id, targetParentId);
        onNotify("移动成功");
      } else if (targetPickerAction.scope === "single" && targetPickerAction.mode === "copy") {
        const nextName = targetPickerCopyName.trim();
        await copyCloudItem(targetPickerAction.item.id, targetParentId, nextName || undefined);
        onNotify("复制成功");
      } else if (targetPickerAction.scope === "batch" && targetPickerAction.mode === "move") {
        const result = await batchMoveCloudItems(selectedIds, targetParentId);
        onNotify(`批量移动完成：成功 ${result.success} / ${result.total}`);
      } else if (targetPickerAction.scope === "batch" && targetPickerAction.mode === "copy") {
        const result = await batchCopyCloudItems(selectedIds, targetParentId);
        onNotify(`批量复制完成：成功 ${result.success} / ${result.total}`);
      }

      closeTargetPicker();
      await refreshAll(currentParentId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "操作失败");
    } finally {
      setTargetPickerSubmitting(false);
      setLoading(false);
    }
  }

  async function handleMove(item: CloudItem) {
    await openTargetPicker({ mode: "move", scope: "single", item });
  }

  async function handleCopy(item: CloudItem) {
    await openTargetPicker({ mode: "copy", scope: "single", item });
  }

  async function handleBatchDelete() {
    if (selectedIds.length === 0) {
      onNotify("请先选择要删除的项目");
      return;
    }
    const ok = window.confirm(`确认删除已选 ${selectedIds.length} 项吗？此操作不可恢复。`);
    if (!ok) {
      return;
    }

    setLoading(true);
    try {
      const result = await batchDeleteCloudItems(selectedIds);
      onNotify(`批量删除完成：成功 ${result.success} / ${result.total}`);
      await refreshAll(currentParentId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "批量删除失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleBatchMove() {
    if (selectedIds.length === 0) {
      onNotify("请先选择要移动的项目");
      return;
    }
    await openTargetPicker({ mode: "move", scope: "batch" });
  }

  async function handleBatchCopy() {
    if (selectedIds.length === 0) {
      onNotify("请先选择要复制的项目");
      return;
    }
    await openTargetPicker({ mode: "copy", scope: "batch" });
  }

  function openShareModal(item: CloudItem) {
    setShareModalItem(item);
    setSharePassword("");
    setShareExpiresMinutes("");
  }

  async function submitCreateShare() {
    if (!shareModalItem) {
      return;
    }
    const password = sharePassword.trim();
    const expiresInput = shareExpiresMinutes.trim();
    const expiresMinutes = expiresInput ? Number(expiresInput) : undefined;
    if (expiresMinutes !== undefined && (!Number.isFinite(expiresMinutes) || expiresMinutes <= 0)) {
      onNotify("过期时间必须是正整数");
      return;
    }

    setLoading(true);
    try {
      const created = await createCloudShare({
        itemId: shareModalItem.id,
        password,
        expiresMinutes,
      });
      if (password) {
        saveSharePasswords({ ...sharePasswords, [created.share_code]: password });
      }
      onNotify("分享创建成功");
      setShareModalItem(null);
      await refreshSummaryAndShares();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "分享创建失败");
    } finally {
      setLoading(false);
    }
  }

  function openContextMenu(event: React.MouseEvent<HTMLElement>, item: CloudItem) {
    event.preventDefault();
    setContextMenu({ item, x: event.clientX, y: event.clientY });
  }

  function runContextAction(action: string, item: CloudItem) {
    setContextMenu(null);
    if (action === "open") {
      enterFolder(item);
      return;
    }
    if (action === "rename") {
      openRenameModal(item);
      return;
    }
    if (action === "move") {
      void handleMove(item);
      return;
    }
    if (action === "copy") {
      void handleCopy(item);
      return;
    }
    if (action === "share") {
      openShareModal(item);
      return;
    }
    if (action === "delete") {
      void handleDelete(item);
      return;
    }
    if (action === "properties") {
      setPropertiesItem(item);
      return;
    }
    if (action === "preview" && !item.is_folder) {
      setPreviewItem(item);
      return;
    }
    if (action === "download" && !item.is_folder) {
      window.open(`/api/cloud/download/${item.id}`, "_blank");
    }
  }

  async function handleCancelShare(shareId: number) {
    setLoading(true);
    try {
      await cancelCloudShare(shareId);
      onNotify("分享已取消");
      const cancelled = shares.find((item) => item.id === shareId);
      if (cancelled && sharePasswords[cancelled.share_code]) {
        const next = { ...sharePasswords };
        delete next[cancelled.share_code];
        saveSharePasswords(next);
      }
      await refreshSummaryAndShares();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "取消分享失败");
    } finally {
      setLoading(false);
    }
  }

  function buildShareCopyUrl(share: CloudShareResponse, password: string) {
    if (!password) {
      return share.share_url;
    }
    const joiner = share.share_url.includes("?") ? "&" : "?";
    return `${share.share_url}${joiner}password=${encodeURIComponent(password)}`;
  }

  async function handleCopyShareLink(share: CloudShareResponse) {
    if (!share.has_password) {
      await copyText(share.share_url, share.id);
      return;
    }
    const stored = sharePasswords[share.share_code] || "";
    if (stored) {
      await copyText(buildShareCopyUrl(share, stored), share.id);
      return;
    }
    setCopyPasswordShare(share);
    setCopyPasswordInput("");
  }

  async function confirmCopyWithPassword() {
    if (!copyPasswordShare || !copyPasswordInput.trim()) {
      return;
    }
    const password = copyPasswordInput.trim();
    saveSharePasswords({ ...sharePasswords, [copyPasswordShare.share_code]: password });
    await copyText(buildShareCopyUrl(copyPasswordShare, password), copyPasswordShare.id);
    setCopyPasswordShare(null);
    setCopyPasswordInput("");
  }

  return (
    <section className="soft-panel rounded-3xl p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {mode === "upload"
              ? "云盘 · 上传"
              : mode === "files"
                ? "云盘 · 文件管理"
                : mode === "shares"
                  ? "云盘 · 分享管理"
                  : "云盘 · 数据统计"}
          </h2>
        </div>
        {mode === "upload" ? <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} /> : null}
      </div>

      {mode === "stats" ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CloudMetricCard title="总条目" value={String(summary?.total_items ?? 0)} />
            <CloudMetricCard title="文件数" value={String(summary?.total_files ?? 0)} />
            <CloudMetricCard title="目录数" value={String(summary?.total_folders ?? 0)} />
            <CloudMetricCard title="已用空间" value={`${formatFileSize(summary?.total_size ?? 0)} / ${formatFileSize(summary?.total_space ?? 0)}`} />
          </div>

          <div className="mb-4 rounded-2xl border border-border/70 bg-white/80 p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>空间使用率</span>
              <span>{usagePercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${usagePercent}%` }} />
            </div>
          </div>
        </>
      ) : null}

      {mode === "upload" ? (
        <>
          <label
            className={
              uploadDropActive
                ? "flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-primary bg-primary/5 p-6 text-center"
                : "flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/80 bg-white/70 p-6 text-center transition hover:border-primary/70 hover:bg-white"
            }
            onDragOver={(event) => {
              event.preventDefault();
              setUploadDropActive(true);
            }}
            onDragLeave={() => setUploadDropActive(false)}
            onDrop={(event) => {
              void handleUploadDrop(event);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <p className="text-base font-semibold">拖拽文件到这里上传</p>
            <p className="mt-1 text-sm text-muted-foreground">或点击此区域选择多个文件上传到当前目录</p>
            <div className="mt-4">
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || loading}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? "上传中..." : "选择文件"}
              </Button>
            </div>
          </label>
        </>
      ) : null}

      {mode === "files" ? (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              {pathNodes.map((node, index) => {
                const isCurrent = index === pathNodes.length - 1;
                return (
                  <div key={`${node.id ?? "root"}-${index}`} className="flex items-center">
                    <button
                      type="button"
                      className={
                        isCurrent
                          ? "rounded-md border border-primary/35 bg-primary/10 px-2.5 py-1 text-primary"
                          : "rounded-md border border-border/70 bg-white px-2.5 py-1 hover:bg-muted/40"
                      }
                      onClick={() => jumpToPath(index)}
                    >
                      {node.name}
                    </button>
                    {index < pathNodes.length - 1 ? <ChevronRight className="mx-1 h-3.5 w-3.5 text-muted-foreground" /> : null}
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={goToParentLevel}
              disabled={pathNodes.length <= 1 || loading}
            >
              <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 上一层
            </Button>
          </div>

          <form className="mb-4 grid gap-2 lg:grid-cols-[1fr_auto_auto]" onSubmit={handleSearchSubmit}>
            <input
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="搜索名称"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
            />
            <Button type="submit" variant="outline">搜索</Button>
            <InlineSelect
              value={sortOption}
              onChange={(value) => {
                void handleSortChange(value);
              }}
              options={[
                { value: "name-asc", label: "名称升序" },
                { value: "name-desc", label: "名称降序" },
                { value: "time-asc", label: "创建时间升序" },
                { value: "time-desc", label: "创建时间降序" },
                { value: "size-asc", label: "大小升序" },
                { value: "size-desc", label: "大小降序" },
              ]}
            />
          </form>

          <div className="mb-4 rounded-2xl border border-border/70 bg-white/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                已选 {selectedIds.length} / {items.length} 项
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={toggleSelectAllCurrent} disabled={items.length === 0 || loading}>
                  {selectedIds.length === items.length && items.length > 0 ? "取消全选" : "全选"}
                </Button>
                <div className="relative">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setBatchActionMenuOpen((value) => !value)}
                    disabled={selectedIds.length === 0 || loading}
                  >
                    操作 <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                  {batchActionMenuOpen ? (
                    <div className="absolute right-0 top-9 z-20 min-w-32 rounded-lg border border-border/80 bg-white p-1.5 shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-muted"
                        onClick={() => {
                          setBatchActionMenuOpen(false);
                          void handleBatchMove();
                        }}
                      >
                        批量移动
                      </button>
                      <button
                        type="button"
                        className="mt-1 flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-muted"
                        onClick={() => {
                          setBatchActionMenuOpen(false);
                          void handleBatchCopy();
                        }}
                      >
                        批量复制
                      </button>
                      <button
                        type="button"
                        className="mt-1 flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs text-rose-600 transition hover:bg-rose-50"
                        onClick={() => {
                          setBatchActionMenuOpen(false);
                          void handleBatchDelete();
                        }}
                      >
                        批量删除
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="relative">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCreateMenuOpen((value) => !value)}
                    disabled={loading}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> 新建
                  </Button>
                  {createMenuOpen ? (
                    <div className="absolute right-0 top-9 z-20 min-w-32 rounded-lg border border-border/80 bg-white p-1.5 shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-muted"
                        onClick={() => {
                          setCreateMenuOpen(false);
                          void handleCreateFolder();
                        }}
                      >
                        新建文件夹
                      </button>
                      <button
                        type="button"
                        className="mt-1 flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-muted"
                        onClick={() => {
                          setCreateMenuOpen(false);
                          handleCreateFile();
                        }}
                      >
                        新建文件
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {items.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="group"
                  onContextMenu={(event) => openContextMenu(event, item)}
                >
                  {(() => {
                    const visual = getCloudItemVisual(item);
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <div className="relative mx-auto w-full max-w-[116px]">
                        <button
                          type="button"
                          aria-label={isSelected ? "取消选择" : "选择"}
                          aria-pressed={isSelected}
                          className={
                            isSelected
                              ? "absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-md border border-primary/40 bg-primary text-primary-foreground shadow-sm"
                              : "absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-md border border-border/80 bg-white/95 text-transparent opacity-0 shadow-sm transition hover:border-primary/40 group-hover:opacity-100"
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSelect(item.id);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="flex w-full flex-col items-center gap-2 rounded-xl p-2 text-center transition hover:bg-muted/25"
                          onClick={() => enterFolder(item)}
                          disabled={!item.is_folder}
                          title={item.name}
                        >
                          <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${visual.bgClass} shadow-[0_8px_18px_rgba(106,71,30,0.12)]`}>
                            {visual.icon}
                          </span>
                          <p className="w-full truncate text-[11px] font-semibold leading-tight" title={item.name}>{item.name}</p>
                        </button>
                      </div>
                    );
                  })()}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-white/55 px-4 py-10 text-center text-sm text-muted-foreground">
              当前目录暂无文件
            </div>
          )}

          {contextMenu ? (
            <div
              className="fixed z-[70] min-w-44 rounded-xl border border-border/80 bg-white/95 p-1.5 shadow-[0_14px_36px_rgba(0,0,0,0.22)] backdrop-blur"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              {contextMenu.item.is_folder ? (
                <ContextMenuButton onClick={() => runContextAction("open", contextMenu.item)}>
                  <Folder className="h-3.5 w-3.5" /> 打开目录
                </ContextMenuButton>
              ) : (
                <>
                  <ContextMenuButton onClick={() => runContextAction("preview", contextMenu.item)}>
                    <Eye className="h-3.5 w-3.5" /> 预览
                  </ContextMenuButton>
                  <ContextMenuButton onClick={() => runContextAction("download", contextMenu.item)}>
                    <Download className="h-3.5 w-3.5" /> 下载
                  </ContextMenuButton>
                </>
              )}
              <ContextMenuButton onClick={() => runContextAction("rename", contextMenu.item)}>
                <Pencil className="h-3.5 w-3.5" /> 重命名
              </ContextMenuButton>
              <ContextMenuButton onClick={() => runContextAction("move", contextMenu.item)}>
                <FolderOpen className="h-3.5 w-3.5" /> 移动
              </ContextMenuButton>
              <ContextMenuButton onClick={() => runContextAction("copy", contextMenu.item)}>
                <CopyIcon /> 复制
              </ContextMenuButton>
              <ContextMenuButton onClick={() => runContextAction("share", contextMenu.item)}>
                <Share2 className="h-3.5 w-3.5" /> 分享
              </ContextMenuButton>
              <ContextMenuButton onClick={() => runContextAction("properties", contextMenu.item)}>
                <File className="h-3.5 w-3.5" /> 属性
              </ContextMenuButton>
              <div className="my-1 h-px bg-border/80" />
              <ContextMenuButton danger onClick={() => runContextAction("delete", contextMenu.item)}>
                <Trash2 className="h-3.5 w-3.5" /> 删除
              </ContextMenuButton>
            </div>
          ) : null}

          {propertiesItem ? (
            <div
              className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4"
              onClick={() => setPropertiesItem(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className="text-sm font-semibold">文件属性</h3>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={propertiesItem.name}>{propertiesItem.name}</p>

                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <InfoCell label="ID" value={String(propertiesItem.id)} />
                  <InfoCell label="父目录ID" value={propertiesItem.parent_id === null ? "根目录" : String(propertiesItem.parent_id)} />
                  <InfoCell label="类型" value={propertiesItem.is_folder ? "文件夹" : "文件"} />
                  <InfoCell label="扩展名" value={propertiesItem.file_ext || "-"} />
                  <InfoCell label="MIME" value={propertiesItem.mime_type || "-"} />
                  <InfoCell label="大小" value={propertiesItem.is_folder ? "-" : formatFileSize(propertiesItem.file_size)} />
                  <InfoCell label="访问性" value={propertiesItem.is_public ? "公开" : "私有"} />
                  <InfoCell label="创建时间" value={propertiesItem.created_at} />
                  <InfoCell label="更新时间" value={propertiesItem.updated_at} />
                </dl>

                <div className="mt-4 flex justify-end">
                  <Button type="button" variant="outline" onClick={() => setPropertiesItem(null)}>关闭</Button>
                </div>
              </div>
            </div>
          ) : null}

          {renameModalItem ? (
            <div
              className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4"
              onClick={() => setRenameModalItem(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className="text-sm font-semibold">重命名</h3>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={renameModalItem.name}>{renameModalItem.name}</p>
                <input
                  className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  placeholder="输入新名称"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setRenameModalItem(null)} disabled={loading}>取消</Button>
                  <Button type="button" onClick={() => void submitRename()} disabled={loading || !renameValue.trim()}>保存</Button>
                </div>
              </div>
            </div>
          ) : null}

          {shareModalItem ? (
            <div
              className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4"
              onClick={() => setShareModalItem(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 className="text-sm font-semibold">创建分享</h3>
                <p className="mt-1 truncate text-xs text-muted-foreground" title={shareModalItem.name}>{shareModalItem.name}</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">访问密码（可选）</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={sharePassword}
                      onChange={(event) => setSharePassword(event.target.value)}
                      placeholder="留空表示无需密码"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">过期分钟数（可选）</label>
                    <input
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={shareExpiresMinutes}
                      onChange={(event) => setShareExpiresMinutes(event.target.value)}
                      placeholder="留空表示永不过期"
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setShareModalItem(null)} disabled={loading}>取消</Button>
                  <Button type="button" onClick={() => void submitCreateShare()} disabled={loading}>创建</Button>
                </div>
              </div>
            </div>
          ) : null}

          {previewItem ? (
            <div
              className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-4"
              onClick={() => setPreviewItem(null)}
            >
              <div
                className="w-full max-w-5xl rounded-2xl border border-white/70 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" title={previewItem.name}>{previewItem.name}</p>
                    <p className="text-xs text-muted-foreground">点击遮罩关闭预览</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPreviewItem(null)}>关闭</Button>
                </div>
                <div className="flex max-h-[72vh] items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/30 p-2">
                  {previewItem.mime_type.startsWith("image/") ? (
                    <img src={`/api/cloud/preview/${previewItem.id}`} alt={previewItem.name} className="max-h-[68vh] w-auto rounded" />
                  ) : previewItem.mime_type.startsWith("video/") ? (
                    <PlyrVideo src={`/api/cloud/preview/${previewItem.id}`} className="max-h-[68vh] w-full rounded" />
                  ) : (
                    <div className="px-6 py-10 text-center">
                      <p className="text-sm text-muted-foreground">该类型暂不支持内嵌预览</p>
                      <Button type="button" className="mt-3" onClick={() => window.open(`/api/cloud/preview/${previewItem.id}`, "_blank")}>新窗口打开</Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {mode === "shares" ? (
        <div className="mt-0 rounded-2xl border border-border/70 bg-white/80 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">分享列表</h3>
          <span className="text-xs text-muted-foreground">共 {shares.length} 条</span>
        </div>
        {shares.length > 0 ? (
          <div className="space-y-2">
            {shares.map((share) => (
              <div key={share.id} className="rounded-xl border border-border/70 bg-white/85 p-3 shadow-[0_8px_18px_rgba(106,71,30,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" title={share.item_name || `项目 #${share.item_id}`}>
                      {share.item_name || `项目 #${share.item_id}`}
                    </p>
                    <p className="mt-1 truncate text-xs font-mono text-foreground/90" title={share.share_url}>{share.share_url}</p>
                  </div>
                  <span className={share.has_password ? "rounded-md bg-amber-100 px-2 py-1 text-[11px] font-semibold text-amber-700" : "rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700"}>
                    {share.has_password ? "密码分享" : "公开分享"}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>分享码 {share.share_code}</span>
                  <span>{share.expires_at ? `过期: ${share.expires_at}` : "永不过期"}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCopyShareLink(share)}
                  >
                    {copiedShareId === share.id ? "已复制" : "复制链接"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleCancelShare(share.id)}>
                    取消分享
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无分享记录</p>
        )}
        </div>
      ) : null}

      {copyPasswordShare ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setCopyPasswordShare(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/70 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-sm font-semibold">输入分享密码</h3>
            <p className="mt-1 text-xs text-muted-foreground">复制链接时将自动附带密码参数。</p>
            <input
              className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={copyPasswordInput}
              onChange={(event) => setCopyPasswordInput(event.target.value)}
              placeholder="请输入该分享的密码"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCopyPasswordShare(null)}>取消</Button>
              <Button type="button" onClick={() => void confirmCopyWithPassword()} disabled={!copyPasswordInput.trim()}>
                复制带密码链接
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {targetPickerAction ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4"
          onClick={closeTargetPicker}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-white/70 bg-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {targetPickerAction.mode === "move" ? "选择移动到的目录" : "选择复制到的目录"}
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={closeTargetPicker} disabled={targetPickerSubmitting}>
                关闭
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {targetPickerPathNodes.map((node, index) => {
                  const isCurrent = index === targetPickerPathNodes.length - 1;
                  return (
                    <div key={`${node.id ?? "root"}-${index}`} className="flex items-center">
                      <button
                        type="button"
                        className={
                          isCurrent
                            ? "rounded-md border border-primary/35 bg-primary/10 px-2.5 py-1 text-primary"
                            : "rounded-md border border-border/70 bg-white px-2.5 py-1 hover:bg-muted/40"
                        }
                        onClick={() => {
                          void jumpTargetPickerPath(index);
                        }}
                      >
                        {node.name}
                      </button>
                      {index < targetPickerPathNodes.length - 1 ? <ChevronRight className="mx-1 h-3.5 w-3.5 text-muted-foreground" /> : null}
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void goTargetPickerParent();
                }}
                disabled={targetPickerPathNodes.length <= 1 || targetPickerLoading || targetPickerSubmitting}
              >
                <ChevronLeft className="mr-1 h-3.5 w-3.5" /> 上一层
              </Button>
            </div>

            {targetPickerAction.mode === "copy" && targetPickerAction.scope === "single" ? (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-muted-foreground">复制后名称（可选）</label>
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                  value={targetPickerCopyName}
                  onChange={(event) => setTargetPickerCopyName(event.target.value)}
                  placeholder="留空将使用原名称"
                  disabled={targetPickerSubmitting}
                />
              </div>
            ) : null}

            <div className="mt-3 h-[300px] overflow-auto rounded-xl border border-border/70 bg-muted/20 p-3">
              {targetPickerLoading ? (
                <p className="text-xs text-muted-foreground">目录加载中...</p>
              ) : targetPickerFolders.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {targetPickerFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      className="flex items-center gap-2 rounded-lg border border-border/70 bg-white px-2.5 py-2 text-left text-xs transition hover:bg-muted/40"
                      onClick={() => {
                        void enterTargetPickerFolder(folder);
                      }}
                      disabled={targetPickerSubmitting}
                    >
                      <Folder className="h-4 w-4 shrink-0 text-amber-700" />
                      <span className="truncate" title={folder.name}>{folder.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">当前目录下暂无子目录，可直接确认选择此目录。</p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeTargetPicker} disabled={targetPickerSubmitting}>取消</Button>
              <Button type="button" onClick={() => void confirmTargetPickerAction()} disabled={targetPickerSubmitting || targetPickerLoading}>
                {targetPickerSubmitting
                  ? "处理中..."
                  : targetPickerAction.mode === "move"
                    ? "确认移动到当前目录"
                    : "确认复制到当前目录"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === "stats" ? (
        <div className="mt-0 grid gap-4 lg:grid-cols-2">
          <article className="rounded-2xl border border-border/70 bg-white/80 p-4">
            <h3 className="mb-3 text-sm font-semibold">容量概览</h3>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <InfoCell label="总条目" value={String(summary?.total_items ?? 0)} />
              <InfoCell label="文件数" value={String(summary?.total_files ?? 0)} />
              <InfoCell label="目录数" value={String(summary?.total_folders ?? 0)} />
              <InfoCell label="已用空间" value={formatFileSize(summary?.total_size ?? 0)} />
              <InfoCell label="总空间" value={formatFileSize(summary?.total_space ?? 0)} />
              <InfoCell label="可用空间" value={formatFileSize(summary?.available_space ?? 0)} />
            </dl>
          </article>

          <article className="rounded-2xl border border-border/70 bg-white/80 p-4">
            <h3 className="mb-3 text-sm font-semibold">近期访问（Top 5）</h3>
            {(summary?.recent_top_visits ?? []).length > 0 ? (
              <div className="space-y-2">
                {(summary?.recent_top_visits ?? []).slice(0, 5).map((item, index) => (
                  <div key={`${item.item_id}-${index}`} className="rounded-xl border border-border/60 bg-muted/35 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                          {index + 1}
                        </span>
                        <span className="truncate text-xs font-medium" title={item.item_name}>{item.item_name}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground/85">访问 {item.visit_count} 次</span>
                    </div>
                    <p className="mt-1 pl-7 text-[11px] text-muted-foreground">{item.last_accessed_at ? `最近访问：${item.last_accessed_at}` : "最近访问时间未知"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">最近 7 天暂无访问数据</p>
            )}
          </article>
        </div>
      ) : null}
    </section>
  );
}

function CloudMetricCard({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-2xl border border-border/70 bg-white/72 p-4 shadow-[0_8px_18px_rgba(106,71,30,0.08)]">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </article>
  );
}

function InlineSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        className="inline-flex h-10 min-w-28 items-center justify-between gap-2 rounded-xl border border-border/70 bg-white px-3 text-sm shadow-sm transition hover:bg-muted/40"
        onClick={() => setOpen((state) => !state)}
      >
        <span>{currentLabel}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-30 min-w-28 rounded-xl border border-border/80 bg-white p-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={
                value === option.value
                  ? "mb-1 w-full rounded-md bg-primary/10 px-2.5 py-1.5 text-left text-xs font-semibold"
                  : "mb-1 w-full rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-muted"
              }
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getCloudItemVisual(item: CloudItem): {
  icon: ReactNode;
  bgClass: string;
} {
  if (item.is_folder) {
    return {
      icon: <Folder className="h-9 w-9 text-amber-700" />,
      bgClass: "bg-amber-100",
    };
  }

  const extRaw = (item.file_ext || item.name.split(".").pop() || "").toLowerCase();
  const ext = extRaw.startsWith(".") ? extRaw.slice(1) : extRaw;
  const mime = (item.mime_type || "").toLowerCase();

  const imageExts = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "heic", "heif", "ico", "tif", "tiff"]);
  const videoExts = new Set(["mp4", "mov", "mkv", "avi", "webm", "flv", "m4v", "wmv", "ts", "3gp"]);
  const audioExts = new Set(["mp3", "wav", "flac", "aac", "ogg", "m4a", "opus", "aiff"]);
  const archiveExts = new Set(["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "cab"]);
  const docExts = new Set(["doc", "docx", "ppt", "pptx", "txt", "rtf", "md", "markdown"]);
  const sheetExts = new Set(["xls", "xlsx", "csv", "ods", "tsv"]);
  const codeExts = new Set(["js", "ts", "tsx", "jsx", "py", "java", "go", "c", "cpp", "rs", "json", "yaml", "yml", "toml", "ini", "sh", "bat", "ps1", "vue", "svelte", "php", "rb", "swift", "kt", "dart", "xml", "sql"]);
  const appExts = new Set(["apk", "exe", "msi", "dmg", "pkg", "deb", "rpm", "appimage", "ipa"]);
  const fontExts = new Set(["ttf", "otf", "woff", "woff2", "eot"]);
  const subtitleExts = new Set(["srt", "ass", "ssa", "vtt", "sub"]);

  if (imageExts.has(ext) || mime.startsWith("image/")) {
    return {
      icon: <Image className="h-9 w-9 text-emerald-700" />,
      bgClass: "bg-emerald-100",
    };
  }
  if (videoExts.has(ext) || mime.startsWith("video/")) {
    return {
      icon: <Video className="h-9 w-9 text-cyan-700" />,
      bgClass: "bg-cyan-100",
    };
  }
  if (audioExts.has(ext) || mime.startsWith("audio/")) {
    return {
      icon: <Music className="h-9 w-9 text-violet-700" />,
      bgClass: "bg-violet-100",
    };
  }
  if (archiveExts.has(ext)) {
    return {
      icon: <Archive className="h-9 w-9 text-orange-700" />,
      bgClass: "bg-orange-100",
    };
  }
  if (ext === "pdf") {
    return {
      icon: <ExtBadge ext="PDF" textClass="text-rose-700" />,
      bgClass: "bg-rose-100",
    };
  }
  if (docExts.has(ext) || mime.includes("word") || mime.includes("powerpoint") || mime.startsWith("text/")) {
    if (ext === "doc" || ext === "docx") {
      return {
        icon: <ExtBadge ext="DOC" textClass="text-blue-700" />,
        bgClass: "bg-blue-100",
      };
    }
    if (ext === "ppt" || ext === "pptx") {
      return {
        icon: <ExtBadge ext="PPT" textClass="text-orange-700" />,
        bgClass: "bg-orange-100",
      };
    }
    if (ext === "txt") {
      return {
        icon: <ExtBadge ext="TXT" textClass="text-slate-700" />,
        bgClass: "bg-slate-100",
      };
    }
    return {
      icon: <FileText className="h-9 w-9 text-blue-700" />,
      bgClass: "bg-blue-100",
    };
  }
  if (sheetExts.has(ext) || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) {
    if (ext === "csv") {
      return {
        icon: <ExtBadge ext="CSV" textClass="text-emerald-700" />,
        bgClass: "bg-emerald-100",
      };
    }
    return {
      icon: <FileSpreadsheet className="h-9 w-9 text-lime-700" />,
      bgClass: "bg-lime-100",
    };
  }
  if (appExts.has(ext) || mime.includes("android") || mime.includes("x-msdownload")) {
    if (ext === "apk") {
      return {
        icon: <ExtBadge ext="APK" textClass="text-fuchsia-700" />,
        bgClass: "bg-fuchsia-100",
      };
    }
    if (ext === "exe") {
      return {
        icon: <ExtBadge ext="EXE" textClass="text-red-700" />,
        bgClass: "bg-red-100",
      };
    }
    if (ext === "dmg") {
      return {
        icon: <ExtBadge ext="DMG" textClass="text-indigo-700" />,
        bgClass: "bg-indigo-100",
      };
    }
    return {
      icon: <Package className="h-9 w-9 text-fuchsia-700" />,
      bgClass: "bg-fuchsia-100",
    };
  }
  if (fontExts.has(ext)) {
    return {
      icon: <ExtBadge ext="FONT" textClass="text-purple-700" />,
      bgClass: "bg-purple-100",
    };
  }
  if (subtitleExts.has(ext)) {
    return {
      icon: <ExtBadge ext="SUB" textClass="text-teal-700" />,
      bgClass: "bg-teal-100",
    };
  }
  if (codeExts.has(ext) || mime.includes("json") || mime.includes("xml") || mime.includes("javascript")) {
    return {
      icon: <FileCode2 className="h-9 w-9 text-sky-700" />,
      bgClass: "bg-sky-100",
    };
  }

  return {
    icon: ext ? <ExtBadge ext={ext.toUpperCase().slice(0, 4)} textClass="text-slate-700" /> : <File className="h-9 w-9 text-slate-700" />,
    bgClass: "bg-slate-100",
  };
}

function ExtBadge({ ext, textClass }: { ext: string; textClass: string }) {
  return <span className={`text-xs font-extrabold tracking-wide ${textClass}`}>{ext}</span>;
}

function ContextMenuButton({
  onClick,
  children,
  danger = false,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={
        danger
          ? "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-rose-600 transition hover:bg-rose-50"
          : "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition hover:bg-muted"
      }
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
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
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(2)} ${units[index]}`;
}
