import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BarChart3, Copy, Download, Link2, ListChecks, Save, Search, Share2, Tags, Trash2, Type } from "lucide-react";
import CodeMirror from "@uiw/react-codemirror";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ApiError,
  cancelSnippetShare,
  createSnippet,
  createSnippetShare,
  deleteSnippet,
  listSnippetTags,
  listSnippetShares,
  listSnippets,
  updateSnippet,
} from "@/lib/api";
import { useSnippetHighlight, snippetEditorExtensions } from "@/lib/snippet-code";
import type { SnippetItem, SnippetShare } from "@/lib/types";
import { copyText } from "@/lib/utils";

interface SnippetPageProps {
  mode: "editor" | "list" | "shares" | "stats";
  onAuthExpired: () => void;
  onNotify: (message: string) => void;
}

const EDITOR_LANGUAGE_OPTIONS = [
  "python",
  "javascript",
  "typescript",
  "java",
  "go",
  "rust",
  "c",
  "cpp",
  "csharp",
  "php",
  "ruby",
  "kotlin",
  "swift",
  "sql",
  "bash",
  "json",
  "yaml",
  "markdown",
  "html",
  "css",
  "text",
];

function languageLabel(value: string): string {
  if (value === "all") return "全部语言";
  return value;
}

interface SnippetContextMenuState {
  item: SnippetItem;
  x: number;
  y: number;
}

export function SnippetPage({ mode, onAuthExpired, onNotify }: SnippetPageProps) {
  const [snippets, setSnippets] = useState<SnippetItem[]>([]);
  const [shares, setShares] = useState<SnippetShare[]>([]);

  const [queryDraft, setQueryDraft] = useState("");
  const [languageDraft, setLanguageDraft] = useState("all");
  const [tagDraft, setTagDraft] = useState("all");
  const [queryApplied, setQueryApplied] = useState("");
  const [languageApplied, setLanguageApplied] = useState("all");
  const [tagApplied, setTagApplied] = useState("all");
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  const [selected, setSelected] = useState<SnippetItem | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("python");
  const [codeContent, setCodeContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const [sharePassword, setSharePassword] = useState("");
  const [shareExpiresMinutes, setShareExpiresMinutes] = useState("");
  const [shareMaxAccessCount, setShareMaxAccessCount] = useState("");
  const [shareOneTime, setShareOneTime] = useState(false);

  const [loading, setLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<SnippetItem | null>(null);
  const [previewCopied, setPreviewCopied] = useState(false);
  const [contextMenu, setContextMenu] = useState<SnippetContextMenuState | null>(null);

  const [renameTarget, setRenameTarget] = useState<SnippetItem | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [retagTarget, setRetagTarget] = useState<SnippetItem | null>(null);
  const [retagValue, setRetagValue] = useState("");

  const [editTarget, setEditTarget] = useState<SnippetItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLanguage, setEditLanguage] = useState("python");
  const [editCodeContent, setEditCodeContent] = useState("");
  const [editTagInput, setEditTagInput] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);

  const [shareTarget, setShareTarget] = useState<SnippetItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SnippetItem | null>(null);

  const parsedTags = useMemo(
    () =>
      tagInput
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    [tagInput],
  );

  const editorExtensions = useMemo(() => snippetEditorExtensions(language), [language]);

  const previewHtml = useSnippetHighlight(codeContent, language);

  const previewItemHtml = useSnippetHighlight(
    previewItem?.code_content ?? "",
    previewItem?.effective_language ?? "text",
  );

  const languageFilterOptions = useMemo(
    () => [
      { value: "all", label: "全部语言" },
      ...EDITOR_LANGUAGE_OPTIONS.map((item) => ({ value: item, label: languageLabel(item) })),
    ],
    [],
  );

  const languageEditorOptions = useMemo(
    () => EDITOR_LANGUAGE_OPTIONS.map((item) => ({ value: item, label: languageLabel(item) })),
    [],
  );

  const tagFilterOptions = useMemo(
    () => [{ value: "all", label: "全部标签" }, ...availableTags.map((name) => ({ value: name, label: `#${name}` }))],
    [availableTags],
  );

  const statsData = useMemo(() => {
    const total = snippets.length;
    const totalLines = snippets.reduce((sum, item) => sum + Math.max(item.line_count || 0, 1), 0);
    const publicCount = snippets.filter((item) => item.is_public).length;
    const activeShares = shares.filter((item) => item.is_active).length;
    const totalVisits = shares.reduce((sum, item) => sum + item.access_count, 0);

    const languageMap = new Map<string, number>();
    snippets.forEach((item) => {
      const key = item.effective_language || "text";
      languageMap.set(key, (languageMap.get(key) || 0) + 1);
    });

    const languageTop = Array.from(languageMap.entries())
      .map(([lang, count]) => ({ lang, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const recentAccess = [...shares]
      .filter((item) => item.last_accessed_at)
      .sort((a, b) => String(b.last_accessed_at).localeCompare(String(a.last_accessed_at)))
      .slice(0, 5);

    return {
      total,
      totalLines,
      publicCount,
      activeShares,
      totalVisits,
      languageTop,
      recentAccess,
    };
  }, [shares, snippets]);

  function closeMenusAndDialogs() {
    setContextMenu(null);
  }

  useEffect(() => {
    function closeMenuOnWindowEvents() {
      closeMenusAndDialogs();
    }

    window.addEventListener("click", closeMenuOnWindowEvents);
    window.addEventListener("scroll", closeMenuOnWindowEvents, true);
    window.addEventListener("resize", closeMenuOnWindowEvents);
    return () => {
      window.removeEventListener("click", closeMenuOnWindowEvents);
      window.removeEventListener("scroll", closeMenuOnWindowEvents, true);
      window.removeEventListener("resize", closeMenuOnWindowEvents);
    };
  }, []);

  async function refreshSnippets() {
    try {
      const payload = await listSnippets({
        query: queryApplied,
        language: languageApplied,
        tag: tagApplied === "all" ? "" : tagApplied,
      });
      setSnippets(payload.items);
      if (selected) {
        const latest = payload.items.find((item) => item.id === selected.id);
        if (latest) {
          loadSnippetToEditor(latest);
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "代码片列表加载失败");
    }
  }

  async function refreshShares() {
    try {
      const payload = await listSnippetShares();
      setShares(payload);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "分享记录加载失败");
    }
  }

  async function refreshTags() {
    try {
      const tags = await listSnippetTags();
      setAvailableTags(tags.map((item) => item.name));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "标签加载失败");
    }
  }

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await refreshSnippets();
      await refreshShares();
      await refreshTags();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void refreshSnippets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryApplied, languageApplied, tagApplied]);

  function applySearch() {
    setQueryApplied(queryDraft.trim());
    setLanguageApplied(languageDraft);
    setTagApplied(tagDraft);
  }

  function loadSnippetToEditor(item: SnippetItem) {
    setSelected(item);
    setTitle(item.title);
    setDescription(item.description);
    setLanguage(item.language && item.language !== "auto" ? item.language : item.effective_language || "python");
    setCodeContent(item.code_content);
    setTagInput(item.tags.join(", "));
    setIsPublic(item.is_public);
  }

  function resetEditor() {
    setSelected(null);
    setTitle("");
    setDescription("");
    setLanguage("python");
    setCodeContent("");
    setTagInput("");
    setIsPublic(true);
  }

  async function handleSaveSnippet() {
    const payload = {
      title: title.trim(),
      description: description.trim(),
      language,
      code_content: codeContent,
      folder_id: null,
      tags: parsedTags,
      is_public: isPublic,
    };

    if (!payload.title || !payload.code_content.trim()) {
      onNotify("标题和代码内容不能为空");
      return;
    }

    try {
      if (selected) {
        const next = await updateSnippet(selected.id, payload);
        loadSnippetToEditor(next);
        onNotify("代码片更新成功");
      } else {
        const created = await createSnippet(payload);
        loadSnippetToEditor(created);
        onNotify("代码片创建成功");
      }
      await refreshSnippets();
      await refreshTags();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "保存失败");
    }
  }

  async function handleDeleteSnippet(item: SnippetItem) {
    try {
      await deleteSnippet(item.id);
      if (selected?.id === item.id) {
        resetEditor();
      }
      onNotify("代码片已删除");
      await refreshSnippets();
      await refreshTags();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "删除失败");
    }
  }

  async function createShareForItem(item: SnippetItem): Promise<boolean> {
    try {
      const share = await createSnippetShare(item.id, {
        password: sharePassword || undefined,
        expires_minutes: shareExpiresMinutes ? Number(shareExpiresMinutes) : undefined,
        max_access_count: shareMaxAccessCount ? Number(shareMaxAccessCount) : undefined,
        is_one_time: shareOneTime,
      });
      const copied = await copyText(share.share_url + (sharePassword ? `?password=${encodeURIComponent(sharePassword)}` : ""));
      setSharePassword("");
      setShareExpiresMinutes("");
      setShareMaxAccessCount("");
      setShareOneTime(false);
      onNotify(copied ? "分享创建成功，链接已复制" : "分享创建成功，请手动复制链接");
      await refreshShares();
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return false;
      }
      onNotify(error instanceof Error ? error.message : "分享创建失败");
      return false;
    }
  }

  async function handleCreateShare() {
    if (!selected) {
      onNotify("请先选择一个代码片");
      return;
    }
    await createShareForItem(selected);
  }

  async function handleCancelShare(shareId: number) {
    try {
      await cancelSnippetShare(shareId);
      setShares((previous) => previous.filter((item) => item.id !== shareId));
      onNotify("分享已取消");
      await refreshShares();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "取消分享失败");
    }
  }

  async function handleCopyCode(content: string) {
    try {
      const copied = await copyText(content);
      if (!copied) {
        onNotify("复制失败，请手动复制");
        return;
      }
      onNotify("代码已复制");
    } catch {
      onNotify("复制失败，请手动复制");
    }
  }

  async function handlePreviewCopy(content: string) {
    try {
      const copied = await copyText(content);
      if (!copied) {
        setPreviewCopied(false);
        return;
      }
      setPreviewCopied(true);
      window.setTimeout(() => setPreviewCopied(false), 1600);
    } catch {
      setPreviewCopied(false);
    }
  }

  async function handleCopyShareUrl(url: string) {
    try {
      const copied = await copyText(url);
      onNotify(copied ? "分享链接已复制" : "复制失败，请手动复制链接");
    } catch {
      onNotify("复制失败，请手动复制链接");
    }
  }

  async function updateSnippetFromItem(item: SnippetItem, patch: { title?: string; tags?: string[] }) {
    await updateSnippet(item.id, {
      title: patch.title ?? item.title,
      description: item.description,
      language: item.language && item.language !== "auto" ? item.language : item.effective_language,
      code_content: item.code_content,
      folder_id: null,
      tags: patch.tags ?? item.tags,
      is_public: item.is_public,
    });
  }

  async function submitRename() {
    if (!renameTarget) {
      return;
    }
    const nextTitle = renameValue.trim();
    if (!nextTitle) {
      onNotify("标题不能为空");
      return;
    }
    try {
      await updateSnippetFromItem(renameTarget, { title: nextTitle });
      setRenameTarget(null);
      setRenameValue("");
      onNotify("重命名成功");
      await refreshSnippets();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "重命名失败");
    }
  }

  async function submitRetag() {
    if (!retagTarget) {
      return;
    }
    const nextTags = retagValue
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    try {
      await updateSnippetFromItem(retagTarget, { tags: nextTags });
      setRetagTarget(null);
      setRetagValue("");
      onNotify("标签已更新");
      await refreshSnippets();
      await refreshTags();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "修改标签失败");
    }
  }

  function buildDownloadUrl(snippetId: number) {
    return `/api/snippets/${snippetId}/download`;
  }

  function openEditModal(item: SnippetItem) {
    setEditTarget(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditLanguage(item.language && item.language !== "auto" ? item.language : item.effective_language || "python");
    setEditCodeContent(item.code_content);
    setEditTagInput(item.tags.join(", "));
    setEditIsPublic(item.is_public);
  }

  async function submitEditModal() {
    if (!editTarget) {
      return;
    }

    const payload = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      language: editLanguage,
      code_content: editCodeContent,
      folder_id: null,
      tags: editTagInput
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
      is_public: editIsPublic,
    };

    if (!payload.title || !payload.code_content.trim()) {
      onNotify("标题和代码内容不能为空");
      return;
    }

    try {
      const updated = await updateSnippet(editTarget.id, payload);
      if (selected?.id === updated.id) {
        loadSnippetToEditor(updated);
      }
      setEditTarget(null);
      onNotify("代码片更新成功");
      await refreshSnippets();
      await refreshTags();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onAuthExpired();
        return;
      }
      onNotify(error instanceof Error ? error.message : "保存失败");
    }
  }

  function openShareModal(item: SnippetItem) {
    setShareTarget(item);
    setSharePassword("");
    setShareExpiresMinutes("");
    setShareMaxAccessCount("");
    setShareOneTime(false);
  }

  async function submitShareModal() {
    if (!shareTarget) {
      return;
    }
    const success = await createShareForItem(shareTarget);
    if (success) {
      setShareTarget(null);
    }
  }

  function openContextMenu(event: React.MouseEvent, item: SnippetItem) {
    event.preventDefault();
    const menuWidth = 180;
    const menuHeight = 220;
    const x = Math.min(event.clientX + 2, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY + 2, window.innerHeight - menuHeight - 8);
    setContextMenu({ item, x, y });
  }

  function renderEditorPage() {
    return (
      <section className="rounded-lg border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary/90">Snippet Studio</p>
            <h2 className="mt-1 text-xl font-semibold">编辑器</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" type="button" onClick={resetEditor}>清空</Button>
            <Button size="sm" type="button" onClick={() => void handleSaveSnippet()}>
              <Save className="mr-1 h-3.5 w-3.5" />
              {selected ? "更新" : "保存"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="min-w-0 rounded-lg border bg-card p-3">
            <div className="mb-2 grid gap-2 sm:grid-cols-2">
              <Field className="gap-0">
                <FieldLabel htmlFor="snippet-title" className="sr-only">标题</FieldLabel>
                <Input id="snippet-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
              </Field>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-full min-w-[120px]">
                  <SelectValue placeholder="选择语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>语言</SelectLabel>
                    {languageEditorOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Textarea className="mb-2 min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述（可选）" />
            <Field className="gap-0">
              <FieldLabel htmlFor="snippet-tags" className="sr-only">标签</FieldLabel>
              <Input id="snippet-tags" className="mb-2" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="标签：python,api" />
            </Field>
            <div className="theme-scrollbar overflow-auto rounded-lg border">
              <CodeMirror
                className="snippet-editor-cm"
                value={codeContent}
                height="420px"
                theme={undefined}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  autocompletion: true,
                  highlightActiveLine: true,
                  highlightActiveLineGutter: true,
                  tabSize: 4,
                }}
                extensions={editorExtensions}
                onChange={(value) => setCodeContent(value)}
              />
            </div>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="rounded-lg border bg-card p-3">
              <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Live Preview</p>
              <div className="theme-scrollbar max-h-[420px] overflow-auto rounded-lg border bg-card p-2 text-xs text-foreground">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
            </div>

            <div className="rounded-lg border bg-card p-3">
              <p className="mb-2 text-sm font-semibold">分享快捷设置</p>
              <div className="grid gap-2">
                <Field className="gap-0">
                  <FieldLabel htmlFor="snippet-share-password" className="sr-only">访问密码（可选）</FieldLabel>
                  <Input id="snippet-share-password" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} placeholder="访问密码（可选）" />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field className="gap-0">
                    <FieldLabel htmlFor="snippet-share-expires" className="sr-only">过期分钟</FieldLabel>
                    <Input id="snippet-share-expires" value={shareExpiresMinutes} onChange={(e) => setShareExpiresMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="过期分钟" />
                  </Field>
                  <Field className="gap-0">
                    <FieldLabel htmlFor="snippet-share-max" className="sr-only">最大访问次数</FieldLabel>
                    <Input id="snippet-share-max" value={shareMaxAccessCount} onChange={(e) => setShareMaxAccessCount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="最大访问次数" />
                  </Field>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                  <Checkbox checked={shareOneTime} onCheckedChange={(checked) => setShareOneTime(Boolean(checked))} />
                  <span>一次性分享（阅后即焚）</span>
                </div>
                <Button type="button" onClick={() => void handleCreateShare()}>
                  <Share2 className="mr-1 h-4 w-4" />生成并复制链接
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderListPage() {
    return (
      <section className="rounded-lg border bg-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary/90">Snippet Atlas</p>
            <h2 className="mt-1 text-xl font-semibold">代码片列表</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>代码片 {snippets.length}</span>
            <span>标签统计 {statsData.languageTop.length}</span>
          </div>
        </div>

        <form
          className="mb-4 grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            applySearch();
          }}
        >
          <Field className="gap-0">
            <FieldLabel htmlFor="snippet-search" className="sr-only">按标题或描述搜索</FieldLabel>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="snippet-search"
                className="pl-9"
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                placeholder="按标题或描述搜索"
              />
            </div>
          </Field>
          <Select value={languageDraft} onValueChange={setLanguageDraft}>
            <SelectTrigger className="w-full min-w-[120px]">
              <SelectValue placeholder="全部语言" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>语言</SelectLabel>
                {languageFilterOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select value={tagDraft} onValueChange={setTagDraft}>
            <SelectTrigger className="w-full min-w-[120px]">
              <SelectValue placeholder="全部标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>标签</SelectLabel>
                {tagFilterOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button type="submit">搜索</Button>
        </form>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Spinner /> 加载中...
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snippets.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border bg-card p-4"
              onContextMenu={(event) => openContextMenu(event, item)}
            >
              <Button
                type="button"
                variant="ghost"
                className="h-auto w-full flex-col items-start gap-1 p-0 text-left hover:bg-transparent"
                onClick={() => loadSnippetToEditor(item)}
              >
                <h3 className="line-clamp-1 text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.effective_language} · {item.updated_at}</p>
              </Button>
              {item.description ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.description}</p> : null}
              <div className="mt-2 flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px]">#{tag}</Badge>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center rounded-full border border-border/70 px-2 py-0.5 text-[11px] text-muted-foreground">
                  {item.line_count} 行
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => void handleCopyCode(item.code_content)}
                    title="复制代码"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                    <a href={buildDownloadUrl(item.id)} title="下载" target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-rose-600 hover:bg-rose-50"
                    onClick={() => setDeleteTarget(item)}
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {snippets.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">没有匹配的代码片</p> : null}
        </div>
        )}

        {contextMenu ? createPortal(
          <div
            className="fixed z-[140] min-w-40 rounded-xl border border-border/80 bg-card p-1.5 shadow-sm"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <ContextMenuItem
              label="预览"
              onClick={() => {
                setPreviewItem(contextMenu.item);
                setPreviewCopied(false);
                setContextMenu(null);
              }}
            />
            <ContextMenuItem
              label="分享"
              onClick={() => {
                openShareModal(contextMenu.item);
                setContextMenu(null);
              }}
            />
            <ContextMenuItem
              label="编辑"
              onClick={() => {
                openEditModal(contextMenu.item);
                setContextMenu(null);
              }}
            />
            <ContextMenuItem
              label="重命名"
              onClick={() => {
                setRenameTarget(contextMenu.item);
                setRenameValue(contextMenu.item.title);
                setContextMenu(null);
              }}
            />
            <ContextMenuItem
              label="修改标签"
              onClick={() => {
                setRetagTarget(contextMenu.item);
                setRetagValue(contextMenu.item.tags.join(", "));
                setContextMenu(null);
              }}
            />
          </div>,
          document.body,
        ) : null}

        {previewItem ? (
          <Modal onClose={() => setPreviewItem(null)} title={previewItem.title}>
            <p className="mb-2 text-xs text-muted-foreground">{previewItem.effective_language} · {previewItem.line_count} 行</p>
            <div className="group relative">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={previewCopied
                  ? "absolute right-2 top-2 z-10 border-emerald-300 bg-emerald-50 text-xs text-emerald-700 opacity-100"
                  : "absolute right-2 top-2 z-10 border-border/70 bg-card text-xs text-foreground opacity-0 transition group-hover:opacity-100"}
                onClick={() => void handlePreviewCopy(previewItem.code_content)}
              >
                {previewCopied ? "已复制" : "复制"}
              </Button>
              <div className="theme-scrollbar max-h-[68vh] overflow-auto rounded-xl border border-border/70 bg-card p-2 text-xs text-foreground">
                <div dangerouslySetInnerHTML={{ __html: previewItemHtml }} />
              </div>
            </div>
          </Modal>
        ) : null}

        {renameTarget ? (
          <Modal onClose={() => setRenameTarget(null)} title="重命名代码片">
            <div className="space-y-3">
              <Field className="gap-1">
                <FieldLabel htmlFor="snippet-rename" className="text-xs text-muted-foreground">新标题</FieldLabel>
                <Input id="snippet-rename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setRenameTarget(null)}>取消</Button>
                <Button type="button" onClick={() => void submitRename()}>保存</Button>
              </div>
            </div>
          </Modal>
        ) : null}

        {retagTarget ? (
          <Modal onClose={() => setRetagTarget(null)} title="修改标签">
            <div className="space-y-3">
              <Field className="gap-1">
                <FieldLabel htmlFor="snippet-retag" className="text-xs text-muted-foreground">标签（英文逗号分隔）</FieldLabel>
                <Input id="snippet-retag" value={retagValue} onChange={(e) => setRetagValue(e.target.value)} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setRetagTarget(null)}>取消</Button>
                <Button type="button" onClick={() => void submitRetag()}>保存</Button>
              </div>
            </div>
          </Modal>
        ) : null}

        {editTarget ? (
          <Modal onClose={() => setEditTarget(null)} title={`编辑代码片 · ${editTarget.title}`} maxWidthClass="max-w-4xl">
            <div className="space-y-2 min-w-0">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field className="gap-0">
                    <FieldLabel htmlFor="snippet-edit-title" className="sr-only">标题</FieldLabel>
                    <Input id="snippet-edit-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="标题" />
                  </Field>
                  <Select value={editLanguage} onValueChange={setEditLanguage}>
                    <SelectTrigger className="w-full min-w-[120px]">
                      <SelectValue placeholder="选择语言" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>语言</SelectLabel>
                        {languageEditorOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <Textarea className="min-h-[76px]" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="描述（可选）" />
                <Field className="gap-0">
                  <FieldLabel htmlFor="snippet-edit-tags" className="sr-only">标签</FieldLabel>
                  <Input id="snippet-edit-tags" value={editTagInput} onChange={(e) => setEditTagInput(e.target.value)} placeholder="标签：python,api" />
                </Field>
                <div className="inline-flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                  <Checkbox checked={editIsPublic} onCheckedChange={(checked) => setEditIsPublic(Boolean(checked))} />
                  <span>公开代码片</span>
                </div>
                <div className="theme-scrollbar overflow-auto rounded-xl border border-border/80">
                  <CodeMirror
                    className="snippet-editor-cm"
                    value={editCodeContent}
                    height="58vh"
                    theme={undefined}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      autocompletion: true,
                      highlightActiveLine: true,
                      highlightActiveLineGutter: true,
                      tabSize: 4,
                    }}
                    extensions={snippetEditorExtensions(editLanguage)}
                    onChange={(value) => setEditCodeContent(value)}
                  />
                </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setEditTarget(null)}>取消</Button>
              <Button type="button" onClick={() => void submitEditModal()}>保存变更</Button>
            </div>
          </Modal>
        ) : null}

        {shareTarget ? (
          <Modal onClose={() => setShareTarget(null)} title={`创建分享 · ${shareTarget.title}`}>
            <div className="space-y-3">
              <Field className="gap-1">
                <FieldLabel htmlFor="snippet-modal-share-password" className="text-xs text-muted-foreground">访问密码（可选）</FieldLabel>
                <Input id="snippet-modal-share-password" value={sharePassword} onChange={(e) => setSharePassword(e.target.value)} />
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field className="gap-1">
                  <FieldLabel htmlFor="snippet-modal-share-expires" className="text-xs text-muted-foreground">过期分钟（可选）</FieldLabel>
                  <Input id="snippet-modal-share-expires" value={shareExpiresMinutes} onChange={(e) => setShareExpiresMinutes(e.target.value.replace(/[^0-9]/g, ""))} placeholder="例如 60" />
                </Field>
                <Field className="gap-1">
                  <FieldLabel htmlFor="snippet-modal-share-max" className="text-xs text-muted-foreground">最大访问次数（可选）</FieldLabel>
                  <Input id="snippet-modal-share-max" value={shareMaxAccessCount} onChange={(e) => setShareMaxAccessCount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="例如 10" />
                </Field>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                <Checkbox checked={shareOneTime} onCheckedChange={(checked) => setShareOneTime(Boolean(checked))} />
                <span>一次性分享（阅后即焚）</span>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setShareTarget(null)}>取消</Button>
                <Button type="button" onClick={() => void submitShareModal()}>创建并复制链接</Button>
              </div>
            </div>
          </Modal>
        ) : null}

        {deleteTarget ? (
          <Modal onClose={() => setDeleteTarget(null)} title="确认删除">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">确定删除代码片「{deleteTarget.title}」吗？删除后不可恢复。</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setDeleteTarget(null)}>取消</Button>
                <Button
                  type="button"
                  className="bg-rose-600 hover:bg-rose-700"
                  onClick={() => {
                    const target = deleteTarget;
                    setDeleteTarget(null);
                    if (target) {
                      void handleDeleteSnippet(target);
                    }
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
          </Modal>
        ) : null}
      </section>
    );
  }

  function renderSharesPage() {
    return (
      <section className="rounded-lg border bg-card p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary/90">Share Console</p>
            <h2 className="mt-1 text-xl font-semibold">分享管理</h2>
          </div>
          <span className="rounded-full border border-border/70 bg-card px-3 py-1 text-xs">总计 {shares.length} 条分享</span>
        </div>

        <div className="space-y-2">
          {shares.map((share) => (
            <div key={share.id} className="rounded-lg border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{share.snippet_title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {share.share_url} · 访问 {share.access_count}
                    {share.max_access_count ? ` / ${share.max_access_count}` : ""} · {share.is_active ? "有效" : "已关闭"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    创建于 {share.created_at}
                    {share.expires_at ? ` · 过期 ${share.expires_at}` : " · 永不过期"}
                    {share.is_one_time ? " · 一次性" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void handleCopyShareUrl(share.share_url);
                    }}
                  >
                    <Link2 className="mr-1 inline h-3.5 w-3.5" />复制
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="text-rose-600 hover:bg-rose-50"
                    onClick={() => void handleCancelShare(share.id)}
                  >
                    <Type className="mr-1 inline h-3.5 w-3.5" />取消
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {shares.length === 0 ? <p className="text-sm text-muted-foreground">暂无分享记录</p> : null}
        </div>
      </section>
    );
  }

  function renderStatsPage() {
    const maxLang = Math.max(...statsData.languageTop.map((item) => item.count), 1);

    return (
      <section className="rounded-lg border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary/90">Insight Board</p>
            <h2 className="mt-1 text-xl font-semibold">数据统计</h2>
          </div>
          <BarChart3 className="h-5 w-5 text-primary" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatsCard icon={<ListChecks className="h-4 w-4" />} label="代码片总数" value={String(statsData.total)} />
          <StatsCard icon={<Tags className="h-4 w-4" />} label="公开代码片" value={String(statsData.publicCount)} />
          <StatsCard icon={<Share2 className="h-4 w-4" />} label="有效分享" value={String(statsData.activeShares)} />
          <StatsCard icon={<Copy className="h-4 w-4" />} label="总代码行" value={String(statsData.totalLines)} />
          <StatsCard icon={<Link2 className="h-4 w-4" />} label="分享访问" value={String(statsData.totalVisits)} />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">语言分布 TOP5</h3>
            <div className="space-y-2">
              {statsData.languageTop.map((item) => (
                <div key={item.lang}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span>{item.lang}</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/50">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${(item.count / maxLang) * 100}%` }} />
                  </div>
                </div>
              ))}
              {statsData.languageTop.length === 0 ? <p className="text-xs text-muted-foreground">暂无数据</p> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">最近访问</h3>
            <div className="space-y-2">
              {statsData.recentAccess.map((item) => (
                <div key={item.id} className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card px-3 py-2 text-left">
                  <span className="truncate text-sm font-medium">{item.snippet_title}</span>
                  <span className="ml-3 text-xs text-muted-foreground">{item.last_accessed_at}</span>
                </div>
              ))}
              {statsData.recentAccess.length === 0 ? <p className="text-sm text-muted-foreground">暂无记录</p> : null}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (mode === "editor") return renderEditorPage();
  if (mode === "list") return renderListPage();
  if (mode === "shares") return renderSharesPage();
  return renderStatsPage();
}

function StatsCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3">
      <div className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ContextMenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mb-1 h-auto w-full justify-start px-2.5 py-1.5 text-left text-sm hover:bg-muted/70"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function Modal({
  title,
  onClose,
  children,
  maxWidthClass = "max-w-xl",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidthClass?: string;
}) {
  return createPortal(
    <Dialog open onOpenChange={onClose}>
      <DialogContent className={maxWidthClass}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>,
    document.body,
  );
}
