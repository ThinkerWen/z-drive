import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Archive,
  Check,
  CheckCheck,
  ChevronLeft,
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
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
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

type CloudUploadTaskStatus = "waiting" | "uploading" | "success" | "error" | "cancelled";

interface CloudUploadTask {
  id: string;
  file: File;
  progress: number;
  status: CloudUploadTaskStatus;
  error?: string;
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
  const [cloudSelectedFiles, setCloudSelectedFiles] = useState<File[]>([]);
  const [cloudSelectedFilesLabel, setCloudSelectedFilesLabel] = useState("未选择文件");
  const [cloudUploadTasks, setCloudUploadTasks] = useState<CloudUploadTask[]>([]);
  const [copiedShareId, setCopiedShareId] = useState<number | null>(null);
  const [sharePasswords, setSharePasswords] = useState<Record<string, string>>({});
  const [copyPasswordShare, setCopyPasswordShare] = useState<CloudShareResponse | null>(null);
  const [copyPasswordInput, setCopyPasswordInput] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [propertiesItem, setPropertiesItem] = useState<CloudItem | null>(null);
  const [createFolderName, setCreateFolderName] = useState("新建文件夹");
  const [targetPickerAction, setTargetPickerAction] = useState<TargetPickerAction | null>(null);
  const [targetPickerPathNodes, setTargetPickerPathNodes] = useState<Array<{ id: number | null; name: string }>>([ROOT_NODE]);
  const [targetPickerFolders, setTargetPickerFolders] = useState<CloudItem[]>([]);
  const [targetPickerLoading, setTargetPickerLoading] = useState(false);
  const [targetPickerSubmitting, setTargetPickerSubmitting] = useState(false);
  const [targetPickerCopyName, setTargetPickerCopyName] = useState("");
  const [previewItem, setPreviewItem] = useState<CloudItem | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [renameModalItem, setRenameModalItem] = useState<CloudItem | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CloudItem | null>(null);
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = useState(false);
  const [shareModalItem, setShareModalItem] = useState<CloudItem | null>(null);
  const [sharePassword, setSharePassword] = useState("");
  const [shareExpiresMinutes, setShareExpiresMinutes] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    item: CloudItem;
    x: number;
    y: number;
  } | null>(null);
  const [backgroundMenu, setBackgroundMenu] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeCloudUploadsRef = useRef<Record<string, XMLHttpRequest>>({});

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
    if (!contextMenu && !backgroundMenu) {
      return;
    }

    const handleGlobalClose = () => {
      setContextMenu(null);
      setBackgroundMenu(null);
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null);
        setBackgroundMenu(null);
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
  }, [contextMenu, backgroundMenu]);

  useEffect(() => {
    if (!previewItem) {
      setPreviewLoading(false);
      setPreviewError("");
      setPreviewTextContent("");
      return;
    }

    const previewKind = getCloudPreviewKind(previewItem);
    if (previewKind !== "text") {
      setPreviewLoading(false);
      setPreviewError("");
      setPreviewTextContent("");
      return;
    }

    const controller = new AbortController();
    void (async () => {
      setPreviewLoading(true);
      setPreviewError("");
      setPreviewTextContent("");
      try {
        const response = await fetch(buildCloudPreviewUrl(previewItem.id), {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`预览加载失败 (${response.status})`);
        }
        const text = await response.text();
        const maxLen = 600_000;
        setPreviewTextContent(text.length > maxLen ? `${text.slice(0, maxLen)}\n\n... (内容过长，已截断)` : text);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setPreviewError(error instanceof Error ? error.message : "文本预览加载失败");
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [previewItem]);

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

  function openCreateFolderModal() {
    setCreateFolderName("新建文件夹");
    setCreateFolderModalOpen(true);
  }

  function closeCreateFolderModal() {
    setCreateFolderModalOpen(false);
    setCreateFolderName("新建文件夹");
  }

  async function submitCreateFolder() {
    const name = createFolderName.trim();
    if (!name) {
      onNotify("请输入目录名");
      return;
    }
    setLoading(true);
    try {
      await createCloudFolder(currentParentId, name);
      onNotify("目录创建成功");
      closeCreateFolderModal();
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

  function buildCloudUploadUrl(parentId: number | null): string {
    const search = new URLSearchParams();
    if (parentId !== null) {
      search.set("parent_id", String(parentId));
    }
    const suffix = search.size ? `?${search.toString()}` : "";
    return `/api/cloud/upload${suffix}`;
  }

  function updateCloudUploadTask(taskId: string, updater: (task: CloudUploadTask) => CloudUploadTask) {
    setCloudUploadTasks((prev) => prev.map((task) => (task.id === taskId ? updater(task) : task)));
  }

  function setSelectedCloudFiles(files: File[]) {
    setCloudSelectedFiles(files);
    if (files.length === 0) {
      setCloudSelectedFilesLabel("未选择文件");
      return;
    }
    if (files.length === 1) {
      setCloudSelectedFilesLabel(files[0].name);
      return;
    }
    setCloudSelectedFilesLabel(`已选择 ${files.length} 个文件`);
  }

  async function uploadSingleCloudTask(taskId: string, file: File, parentId: number | null): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", buildCloudUploadUrl(parentId), true);
      xhr.withCredentials = true;

      updateCloudUploadTask(taskId, (task) => ({ ...task, status: "uploading", progress: 0, error: undefined }));

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          return;
        }
        const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
        updateCloudUploadTask(taskId, (task) => ({ ...task, progress }));
      };

      xhr.onload = () => {
        delete activeCloudUploadsRef.current[taskId];

        let payload: Record<string, unknown> | null = null;
        try {
          payload = xhr.responseText ? (JSON.parse(xhr.responseText) as Record<string, unknown>) : null;
        } catch {
          payload = null;
        }

        const payloadObj = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
        const isEnvelope = payloadObj !== null && "code" in payloadObj && "data" in payloadObj && "message" in payloadObj;
        const envelopeCode = isEnvelope && typeof payloadObj.code === "number" ? payloadObj.code : null;
        const envelopeMessage = isEnvelope && typeof payloadObj.message === "string" ? payloadObj.message : "";

        if (xhr.status < 200 || xhr.status >= 300 || (envelopeCode !== null && envelopeCode !== 0)) {
          const errorText = envelopeMessage || (typeof payloadObj?.detail === "string" ? payloadObj.detail : "上传失败");
          updateCloudUploadTask(taskId, (task) => ({ ...task, status: "error", error: errorText }));
          reject(new Error(errorText));
          return;
        }

        updateCloudUploadTask(taskId, (task) => ({ ...task, status: "success", progress: 100, error: undefined }));
        resolve();
      };

      xhr.onerror = () => {
        delete activeCloudUploadsRef.current[taskId];
        updateCloudUploadTask(taskId, (task) => ({ ...task, status: "error", error: "网络错误" }));
        reject(new Error("网络错误"));
      };

      xhr.onabort = () => {
        delete activeCloudUploadsRef.current[taskId];
        updateCloudUploadTask(taskId, (task) => ({ ...task, status: "cancelled", error: "已取消" }));
        reject(new Error("已取消"));
      };

      const form = new FormData();
      form.append("file", file);
      xhr.send(form);
      activeCloudUploadsRef.current[taskId] = xhr;
    });
  }

  function cancelCloudUploadTask(taskId: string) {
    const xhr = activeCloudUploadsRef.current[taskId];
    if (xhr) {
      xhr.abort();
      delete activeCloudUploadsRef.current[taskId];
    }
  }

  async function uploadCloudFileList(files: File[]) {
    if (files.length === 0) {
      return;
    }

    setUploading(true);
    try {
      const tasks: CloudUploadTask[] = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        progress: 0,
        status: "waiting",
      }));
      setCloudUploadTasks((prev) => [...tasks, ...prev]);

      const settled = await Promise.allSettled(tasks.map((task) => uploadSingleCloudTask(task.id, task.file, currentParentId)));
      const successCount = settled.filter((item) => item.status === "fulfilled").length;
      onNotify(`上传完成：成功 ${successCount} / ${tasks.length}`);

      if (successCount > 0) {
        await refreshAll(currentParentId);
      }

      setSelectedCloudFiles([]);
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
    setSelectedCloudFiles(files);
    event.target.value = "";
  }

  async function handleUploadDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setUploadDropActive(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    setSelectedCloudFiles(files);
  }

  async function confirmCloudUpload() {
    await uploadCloudFileList(cloudSelectedFiles);
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
    setDeleteTarget(item);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setLoading(true);
    try {
      await deleteCloudItem(deleteTarget.id);
      onNotify("删除成功");
      setDeleteTarget(null);
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

    setBatchDeleteConfirmOpen(true);
  }

  async function confirmBatchDelete() {
    if (selectedIds.length === 0) {
      setBatchDeleteConfirmOpen(false);
      return;
    }

    setLoading(true);
    try {
      const result = await batchDeleteCloudItems(selectedIds);
      onNotify(`批量删除完成：成功 ${result.success} / ${result.total}`);
      setBatchDeleteConfirmOpen(false);
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
    event.stopPropagation();
    setContextMenu({ item, x: event.clientX, y: event.clientY });
  }

  function openBackgroundMenu(event: React.MouseEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
    setBackgroundMenu({ x: event.clientX, y: event.clientY });
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
    <section className="rounded-lg border bg-card p-5 sm:p-6">
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
        {mode === "upload" ? (
          <Input id="cloud-upload-files" ref={fileInputRef} type="file" multiple className="sr-only" onChange={handleUpload} />
        ) : null}
      </div>

      {mode === "stats" ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CloudMetricCard title="总条目" value={String(summary?.total_items ?? 0)} />
            <CloudMetricCard title="文件数" value={String(summary?.total_files ?? 0)} />
            <CloudMetricCard title="目录数" value={String(summary?.total_folders ?? 0)} />
            <CloudMetricCard title="已用空间" value={`${formatFileSize(summary?.total_size ?? 0)} / ${formatFileSize(summary?.total_space ?? 0)}`} />
          </div>

          <div className="mb-4 rounded-lg border bg-card p-3">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>空间使用率</span>
              <span>{usagePercent}%</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>
        </>
      ) : null}

      {mode === "upload" ? (
        <>
          <label
            htmlFor="cloud-upload-files"
            className={
              uploadDropActive
                ? "flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-primary bg-primary/5 p-6 text-center"
                : "flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-6 text-center transition hover:border-primary/70 hover:bg-card"
            }
            onDragOver={(event) => {
              event.preventDefault();
              setUploadDropActive(true);
            }}
            onDragLeave={() => setUploadDropActive(false)}
            onDrop={(event) => {
              void handleUploadDrop(event);
            }}
          >
            <p className="text-base font-semibold">拖拽文件到这里上传</p>
            <p className="mt-1 text-sm text-muted-foreground">或点击此区域选择文件，可一次上传多个文件</p>
            <p className="mt-3 max-w-full truncate rounded-lg bg-card px-3 py-1.5 text-xs text-muted-foreground" title={cloudSelectedFilesLabel}>
              {cloudSelectedFilesLabel}
            </p>
          </label>

          <div className="mt-3 flex justify-end">
            <Button type="button" onClick={() => void confirmCloudUpload()} disabled={uploading || loading || cloudSelectedFiles.length === 0}>
              {uploading ? "上传中..." : "开始上传"}
            </Button>
          </div>

          {cloudUploadTasks.length > 0 ? (
            <div className="mt-4 grid gap-2">
              {cloudUploadTasks.map((task) => (
                <article key={task.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold" title={task.file.name}>{task.file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatFileSize(task.file.size)}</p>
                    </div>
                    <Badge
                      variant={
                        task.status === "success"
                          ? "default"
                          : task.status === "error"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[11px]"
                    >
                      {task.status === "success"
                        ? "完成"
                        : task.status === "error"
                          ? `失败: ${task.error ?? "unknown"}`
                          : task.status === "cancelled"
                            ? "已取消"
                            : `${task.progress}%`}
                    </Badge>
                    {(task.status === "waiting" || task.status === "uploading") ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => cancelCloudUploadTask(task.id)}
                        disabled={task.status === "waiting"}
                      >
                        取消
                      </Button>
                    ) : null}
                  </div>
                  <Progress value={task.progress} className="mt-2 h-1.5" />
                </article>
              ))}
            </div>
          ) : null}
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
                    <Button
                      type="button"
                      size="sm"
                      variant={isCurrent ? "secondary" : "ghost"}
                      className="rounded-lg"
                      onClick={() => jumpToPath(index)}
                    >
                      {node.name}
                    </Button>
                    {index < pathNodes.length - 1 ? <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-muted-foreground" /> : null}
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
            <Field className="gap-0">
              <FieldLabel htmlFor="cloud-search" className="sr-only">搜索名称</FieldLabel>
              <Input
                id="cloud-search"
                placeholder="搜索名称"
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
              />
            </Field>
            <Button type="submit" variant="outline">搜索</Button>
            <Select value={sortOption} onValueChange={(value) => { void handleSortChange(value); }}>
              <SelectTrigger className="w-full max-w-48">
                <SelectValue placeholder="排序方式" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>排序</SelectLabel>
                  <SelectItem value="name-asc">名称升序</SelectItem>
                  <SelectItem value="name-desc">名称降序</SelectItem>
                  <SelectItem value="time-asc">创建时间升序</SelectItem>
                  <SelectItem value="time-desc">创建时间降序</SelectItem>
                  <SelectItem value="size-asc">大小升序</SelectItem>
                  <SelectItem value="size-desc">大小降序</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </form>

          {items.length > 0 ? (
            <div
              className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6"
              onContextMenu={openBackgroundMenu}
            >
              {items.map((item) => (
                <article
                  key={item.id}
                  className="group"
                >
                  {(() => {
                    const visual = getCloudItemVisual(item);
                    const isSelected = selectedIds.includes(item.id);
                    return (
                      <div
                        className={`relative mx-auto w-full max-w-[116px]`}
                        onContextMenu={(event) => openContextMenu(event, item)}
                      >
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label={isSelected ? "取消选择" : "选择"}
                          aria-pressed={isSelected}
                          className={
                            isSelected
                              ? "absolute right-1 top-1 z-10 h-5 w-5 border-primary/40 bg-primary text-primary-foreground shadow-sm"
                              : "absolute right-1 top-1 z-10 h-5 w-5 border-border/80 bg-card text-transparent opacity-0 shadow-sm transition hover:border-primary/40 group-hover:opacity-100"
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSelect(item.id);
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto w-full flex-col items-center gap-2 rounded-xl p-2 text-center hover:bg-muted/25"
                          onClick={() => enterFolder(item)}
                          disabled={!item.is_folder}
                          title={item.name}
                        >
                          <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${visual.bgClass} shadow-sm`}>
                            {visual.icon}
                          </span>
                          <p className="w-full truncate text-[11px] font-semibold leading-tight" title={item.name}>{item.name}</p>
                        </Button>
                      </div>
                    );
                  })()}
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/50 px-4 py-10 text-center text-sm text-muted-foreground">
              当前目录暂无文件
            </div>
          )}

          {contextMenu ? (
            <div
              className="fixed z-[70] min-w-44 rounded-lg border bg-card p-1.5"
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

          {backgroundMenu ? (
            <div
              className="fixed z-[70] min-w-44 rounded-lg border bg-card p-1.5"
              style={{ left: backgroundMenu.x, top: backgroundMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              {(() => {
                const allSelected = items.length > 0 && selectedIds.length === items.length;
                const hasSelection = selectedIds.length > 0;

                return (
                  <>
                    {hasSelection ? (
                      <>
                        <ContextMenuButton onClick={() => { toggleSelectAllCurrent(); setBackgroundMenu(null); }}>
                          {allSelected ? <><Check className="h-3.5 w-3.5" /> 取消全选</> : <><CheckCheck className="h-3.5 w-3.5" /> 全选</>}
                        </ContextMenuButton>
                        <ContextMenuButton onClick={() => { setBackgroundMenu(null); void handleBatchCopy(); }}>
                          <CopyIcon /> 复制 ({selectedIds.length})
                        </ContextMenuButton>
                        <ContextMenuButton onClick={() => { setBackgroundMenu(null); void handleBatchMove(); }}>
                          <FolderOpen className="h-3.5 w-3.5" /> 移动 ({selectedIds.length})
                        </ContextMenuButton>
                        <div className="my-1 h-px bg-border/80" />
                        <ContextMenuButton danger onClick={() => { setBackgroundMenu(null); void handleBatchDelete(); }}>
                          <Trash2 className="h-3.5 w-3.5" /> 删除 ({selectedIds.length})
                        </ContextMenuButton>
                      </>
                    ) : (
                      <>
                        <ContextMenuButton onClick={() => { toggleSelectAllCurrent(); setBackgroundMenu(null); }}>
                          <CheckCheck className="h-3.5 w-3.5" /> 全选
                        </ContextMenuButton>
                        <ContextMenuButton onClick={() => { setBackgroundMenu(null); openCreateFolderModal(); }}>
                          <Plus className="h-3.5 w-3.5" /> 新建文件夹
                        </ContextMenuButton>
                        <ContextMenuButton onClick={() => { setBackgroundMenu(null); goToParentLevel(); }}>
                          <ChevronLeft className="h-3.5 w-3.5" /> 上一层
                        </ContextMenuButton>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          ) : null}

          <Dialog open={Boolean(propertiesItem)} onOpenChange={() => setPropertiesItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>文件属性</DialogTitle>
                <DialogDescription className="truncate" title={propertiesItem?.name}>{propertiesItem?.name}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <InfoCell label="ID" value={String(propertiesItem?.id ?? "")} />
                <InfoCell label="父目录ID" value={propertiesItem?.parent_id === null ? "根目录" : String(propertiesItem?.parent_id)} />
                <InfoCell label="类型" value={propertiesItem?.is_folder ? "文件夹" : "文件"} />
                <InfoCell label="扩展名" value={propertiesItem?.file_ext || "-"} />
                <InfoCell label="MIME" value={propertiesItem?.mime_type || "-"} />
                <InfoCell label="大小" value={propertiesItem?.is_folder ? "-" : formatFileSize(propertiesItem?.file_size ?? 0)} />
                <InfoCell label="访问性" value={propertiesItem?.is_public ? "公开" : "私有"} />
                <InfoCell label="创建时间" value={propertiesItem?.created_at ?? ""} />
                <InfoCell label="更新时间" value={propertiesItem?.updated_at ?? ""} />
              </dl>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(renameModalItem)} onOpenChange={() => setRenameModalItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>重命名</DialogTitle>
                <DialogDescription className="truncate" title={renameModalItem?.name}>{renameModalItem?.name}</DialogDescription>
              </DialogHeader>
              <Field className="gap-0">
                <FieldLabel htmlFor="cloud-rename" className="sr-only">输入新名称</FieldLabel>
                <Input
                  id="cloud-rename"
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  placeholder="输入新名称"
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRenameModalItem(null)} disabled={loading}>取消</Button>
                <Button type="button" onClick={() => void submitRename()} disabled={loading || !renameValue.trim()}>保存</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(shareModalItem)} onOpenChange={() => setShareModalItem(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建分享</DialogTitle>
                <DialogDescription className="truncate" title={shareModalItem?.name}>{shareModalItem?.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Field className="gap-1">
                  <FieldLabel className="text-xs text-muted-foreground">访问密码（可选）</FieldLabel>
                  <Input
                    value={sharePassword}
                    onChange={(event) => setSharePassword(event.target.value)}
                    placeholder="留空表示无需密码"
                  />
                </Field>
                <Field className="gap-1">
                  <FieldLabel className="text-xs text-muted-foreground">过期分钟数（可选）</FieldLabel>
                  <Input
                    value={shareExpiresMinutes}
                    onChange={(event) => setShareExpiresMinutes(event.target.value)}
                    placeholder="留空表示永不过期"
                  />
                </Field>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShareModalItem(null)} disabled={loading}>取消</Button>
                <Button type="button" onClick={() => void submitCreateShare()} disabled={loading}>创建</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createFolderModalOpen} onOpenChange={closeCreateFolderModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新建文件夹</DialogTitle>
                <DialogDescription>输入目录名称后创建到当前目录。</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitCreateFolder();
                }}
              >
                <Field className="gap-0">
                  <FieldLabel htmlFor="cloud-create-folder" className="sr-only">请输入文件夹名称</FieldLabel>
                  <Input
                    id="cloud-create-folder"
                    autoFocus
                    value={createFolderName}
                    onChange={(event) => setCreateFolderName(event.target.value)}
                    placeholder="请输入文件夹名称"
                  />
                </Field>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeCreateFolderModal} disabled={loading}>取消</Button>
                  <Button type="submit" disabled={loading || !createFolderName.trim()}>创建</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {previewItem ? (
            <div
              className="fixed inset-0 z-[75] flex items-center justify-center bg-black/55 p-4"
              onClick={() => setPreviewItem(null)}
            >
              <div
                className="w-full max-w-5xl rounded-2xl border bg-card p-4 shadow-sm"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" title={previewItem.name}>{previewItem.name}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center justify-center rounded-sm border-none bg-transparent p-0.5 text-muted-foreground/70 outline-none transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => setPreviewItem(null)}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">关闭</span>
                  </button>
                </div>
                <div className="flex max-h-[72vh] items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/30 p-2">
                  {getCloudPreviewKind(previewItem) === "image" ? (
                    <img src={buildCloudPreviewUrl(previewItem.id)} alt={previewItem.name} className="max-h-[68vh] w-auto rounded" />
                  ) : getCloudPreviewKind(previewItem) === "video" ? (
                    <PlyrVideo src={buildCloudPreviewUrl(previewItem.id)} className="max-h-[68vh] w-full rounded" />
                  ) : getCloudPreviewKind(previewItem) === "pdf" ? (
                    <iframe title={previewItem.name} src={buildCloudPreviewUrl(previewItem.id)} className="h-[68vh] w-full rounded border border-border/60 bg-card" />
                  ) : getCloudPreviewKind(previewItem) === "text" ? (
                    <div className="theme-scrollbar h-[68vh] w-full overflow-auto rounded border border-border/60 bg-card p-4 text-left">
                      {previewLoading ? <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Spinner /> 文本加载中...</p> : null}
                      {previewError ? <p className="text-sm text-rose-600">{previewError}</p> : null}
                      {!previewLoading && !previewError ? (
                        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-6 text-foreground">{previewTextContent}</pre>
                      ) : null}
                    </div>
                  ) : (
                    <div className="px-6 py-10 text-center">
                      <p className="text-sm text-muted-foreground">该类型暂不支持预览，请下载后查看</p>
                      <Button type="button" className="mt-3" onClick={() => window.open(`/api/cloud/download/${previewItem.id}`, "_blank")}>立即下载</Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <Dialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">确认删除</DialogTitle>
                <DialogDescription>
                  确认删除 <span className="font-semibold text-foreground">{deleteTarget?.name}</span> 吗？此操作不可恢复。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={loading}>取消</Button>
                <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={loading}>删除</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={batchDeleteConfirmOpen} onOpenChange={() => setBatchDeleteConfirmOpen(false)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-destructive">确认批量删除</DialogTitle>
                <DialogDescription>
                  确认删除已选 <span className="font-semibold text-foreground">{selectedIds.length}</span> 项吗？此操作不可恢复。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBatchDeleteConfirmOpen(false)} disabled={loading}>取消</Button>
                <Button type="button" variant="destructive" onClick={() => void confirmBatchDelete()} disabled={loading}>批量删除</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}

      {mode === "shares" ? (
        <div className="mt-0 rounded-lg border bg-card p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">分享列表</h3>
          <span className="text-xs text-muted-foreground">共 {shares.length} 条</span>
        </div>
        {shares.length > 0 ? (
          <div className="space-y-2">
            {shares.map((share) => (
              <div key={share.id} className="rounded-lg border bg-card p-3">
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

      <Dialog open={Boolean(copyPasswordShare)} onOpenChange={() => setCopyPasswordShare(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>输入分享密码</DialogTitle>
            <DialogDescription>复制链接时将自动附带密码参数。</DialogDescription>
          </DialogHeader>
          <Field className="gap-0">
            <FieldLabel htmlFor="cloud-copy-password" className="sr-only">请输入该分享的密码</FieldLabel>
            <Input
              id="cloud-copy-password"
              value={copyPasswordInput}
              onChange={(event) => setCopyPasswordInput(event.target.value)}
              placeholder="请输入该分享的密码"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCopyPasswordShare(null)}>取消</Button>
            <Button type="button" onClick={() => void confirmCopyWithPassword()} disabled={!copyPasswordInput.trim()}>
              复制带密码链接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {targetPickerAction ? (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center bg-black/45 p-4"
          onClick={closeTargetPicker}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border bg-card p-4 shadow-sm"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {targetPickerAction.mode === "move" ? "选择移动到的目录" : "选择复制到的目录"}
              </h3>
              <button
                type="button"
                className="shrink-0 inline-flex items-center justify-center rounded-sm border-none bg-transparent p-0.5 text-muted-foreground/70 outline-none transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none"
                onClick={closeTargetPicker}
                disabled={targetPickerSubmitting}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">关闭</span>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {targetPickerPathNodes.map((node, index) => {
                  const isCurrent = index === targetPickerPathNodes.length - 1;
                  return (
                    <div key={`${node.id ?? "root"}-${index}`} className="flex items-center">
                      <Button
                        type="button"
                        size="sm"
                        variant={isCurrent ? "secondary" : "ghost"}
                        className="rounded-lg"
                        onClick={() => {
                          void jumpTargetPickerPath(index);
                        }}
                      >
                        {node.name}
                      </Button>
                      {index < targetPickerPathNodes.length - 1 ? <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-muted-foreground" /> : null}
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
                <Field className="gap-1">
                  <FieldLabel className="text-xs text-muted-foreground">复制后名称（可选）</FieldLabel>
                  <Input
                    value={targetPickerCopyName}
                    onChange={(event) => setTargetPickerCopyName(event.target.value)}
                    placeholder="留空将使用原名称"
                    disabled={targetPickerSubmitting}
                  />
                </Field>
              </div>
            ) : null}

            <div className="mt-3 h-[300px] overflow-auto rounded-xl border border-border/70 bg-muted/20 p-3">
              {targetPickerLoading ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Spinner className="size-3" /> 目录加载中...</p>
              ) : targetPickerFolders.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {targetPickerFolders.map((folder) => (
                    <Button
                      key={folder.id}
                      type="button"
                      variant="outline"
                      className="h-auto w-full justify-start gap-2 px-2.5 py-2 text-left text-xs"
                      onClick={() => {
                        void enterTargetPickerFolder(folder);
                      }}
                      disabled={targetPickerSubmitting}
                    >
                      <Folder className="h-4 w-4 shrink-0 text-amber-700" />
                      <span className="truncate" title={folder.name}>{folder.name}</span>
                    </Button>
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
          <article className="rounded-2xl border border-border/70 bg-card p-4">
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

          <article className="rounded-2xl border border-border/70 bg-card p-4">
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
    <article className="rounded-lg border bg-muted p-4">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-lg font-semibold">{value}</p>
    </article>
  );
}

function getCloudItemVisual(item: CloudItem): {
  icon: ReactNode;
  bgClass: string;
} {
  const shared = "h-8 w-8 text-secondary-foreground";

  if (item.is_folder) {
    return {
      icon: <Folder className={`${shared} [&_*]:!fill-transparent`} />,
      bgClass: "bg-secondary",
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
    return { icon: <Image className={shared} />, bgClass: "bg-secondary" };
  }
  if (videoExts.has(ext) || mime.startsWith("video/")) {
    return { icon: <Video className={shared} />, bgClass: "bg-secondary" };
  }
  if (audioExts.has(ext) || mime.startsWith("audio/")) {
    return { icon: <Music className={shared} />, bgClass: "bg-secondary" };
  }
  if (archiveExts.has(ext)) {
    return { icon: <Archive className={shared} />, bgClass: "bg-secondary" };
  }
  if (ext === "pdf") {
    return { icon: <ExtBadge ext="PDF" />, bgClass: "bg-secondary" };
  }
  if (docExts.has(ext) || mime.includes("word") || mime.includes("powerpoint") || mime.startsWith("text/")) {
    if (ext === "doc" || ext === "docx") {
      return { icon: <ExtBadge ext="DOC" />, bgClass: "bg-secondary" };
    }
    if (ext === "ppt" || ext === "pptx") {
      return { icon: <ExtBadge ext="PPT" />, bgClass: "bg-secondary" };
    }
    if (ext === "txt") {
      return { icon: <ExtBadge ext="TXT" />, bgClass: "bg-secondary" };
    }
    return { icon: <FileText className={shared} />, bgClass: "bg-secondary" };
  }
  if (sheetExts.has(ext) || mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) {
    if (ext === "csv") {
      return { icon: <ExtBadge ext="CSV" />, bgClass: "bg-secondary" };
    }
    return { icon: <FileSpreadsheet className={shared} />, bgClass: "bg-secondary" };
  }
  if (appExts.has(ext) || mime.includes("android") || mime.includes("x-msdownload")) {
    if (ext === "apk") {
      return { icon: <ExtBadge ext="APK" />, bgClass: "bg-secondary" };
    }
    if (ext === "exe") {
      return { icon: <ExtBadge ext="EXE" />, bgClass: "bg-secondary" };
    }
    if (ext === "dmg") {
      return { icon: <ExtBadge ext="DMG" />, bgClass: "bg-secondary" };
    }
    return { icon: <Package className={shared} />, bgClass: "bg-secondary" };
  }
  if (fontExts.has(ext)) {
    return { icon: <ExtBadge ext="FONT" />, bgClass: "bg-secondary" };
  }
  if (subtitleExts.has(ext)) {
    return { icon: <ExtBadge ext="SUB" />, bgClass: "bg-secondary" };
  }
  if (codeExts.has(ext) || mime.includes("json") || mime.includes("xml") || mime.includes("javascript")) {
    return { icon: <FileCode2 className={shared} />, bgClass: "bg-secondary" };
  }

  return {
    icon: ext ? <ExtBadge ext={ext.toUpperCase().slice(0, 4)} /> : <File className={shared} />,
    bgClass: "bg-secondary",
  };
}

function ExtBadge({ ext }: { ext: string }) {
  return <span className="text-[10px] font-bold tracking-widest text-secondary-foreground">{ext}</span>;
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
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={
        danger
          ? "h-auto w-full justify-start gap-2 px-2.5 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
          : "h-auto w-full justify-start gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-muted"
      }
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

type CloudPreviewKind = "image" | "video" | "text" | "pdf" | "other";

function getCloudPreviewKind(item: CloudItem): CloudPreviewKind {
  const extRaw = (item.file_ext || item.name.split(".").pop() || "").toLowerCase();
  const ext = extRaw.startsWith(".") ? extRaw.slice(1) : extRaw;
  const mime = (item.mime_type || "").toLowerCase();

  const textExts = new Set([
    "txt", "log", "md", "markdown", "html", "htm", "xml", "json", "yaml", "yml", "toml", "ini", "cfg", "conf",
    "csv", "tsv", "py", "js", "ts", "jsx", "tsx", "java", "go", "c", "cpp", "rs", "php", "rb", "sh", "bat", "ps1",
    "sql", "css", "scss", "less",
  ]);

  const isOfficeMime =
    mime.includes("officedocument") ||
    mime.includes("msword") ||
    mime.includes("ms-powerpoint") ||
    mime.includes("ms-excel") ||
    mime.includes("vnd.ms-");
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime === "application/pdf" || ext === "pdf") {
    return "pdf";
  }

  if (isOfficeMime) {
    return "other";
  }

  const knownTextMime =
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/x-yaml" ||
    mime === "application/yaml" ||
    mime === "application/toml" ||
    mime === "application/javascript" ||
    mime === "application/x-javascript" ||
    mime === "application/sql";

  if (textExts.has(ext) || mime.startsWith("text/") || knownTextMime) {
    return "text";
  }

  return "other";
}

function buildCloudPreviewUrl(itemId: number): string {
  return `/api/cloud/preview/${itemId}`;
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
