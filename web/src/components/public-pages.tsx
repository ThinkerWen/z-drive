import { useEffect, useMemo, useState } from "react";

import { PlyrVideo } from "@/components/plyr-video";
import { ApiError, accessCloudShare, getImageInfo } from "@/lib/api";
import type { CloudShareAccessResponse, ImageInfoResponse } from "@/lib/types";

export function parsePublicPreviewPath(pathname: string): { shortCode: string; ext: string } | null {
  const matched = pathname.match(/^\/gallery\/preview\/([^/.]+)\.([A-Za-z0-9]+)$/);
  if (!matched) {
    return null;
  }
  return { shortCode: matched[1], ext: matched[2] };
}

export function parsePublicSharePath(pathname: string): { shareCode: string } | null {
  const matched = pathname.match(/^\/f\/([A-Za-z0-9]+)$/);
  if (!matched) {
    return null;
  }
  return { shareCode: matched[1] };
}

export function PublicErrorPage({ message }: { message?: string }) {
  const queryMessage = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return search.get("message") || "";
  }, []);

  const finalMessage = message || queryMessage || "页面不存在或您的权限不足";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 sm:px-8">
      <div className="soft-panel w-full rounded-3xl border border-white/70 bg-white/90 p-8 text-center shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-orange-200 bg-orange-50 text-2xl font-bold text-orange-600">!</div>
        <h1 className="text-2xl font-semibold tracking-tight">访问失败</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{finalMessage}</p>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          powered by <a className="font-semibold text-teal-700 hover:underline" href="https://github.com/ThinkerWen/z-drive" target="_blank" rel="noreferrer noopener">z-drive</a>
        </p>
      </div>
    </div>
  );
}

export function PublicPreviewPage({ shortCode, ext }: { shortCode: string; ext: string }) {
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [info, setInfo] = useState<ImageInfoResponse | null>(null);
  const [copied, setCopied] = useState("");

  const sign = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return search.get("sign") || "";
  }, []);

  const origin = window.location.origin;
  const querySuffix = sign ? `?sign=${encodeURIComponent(sign)}` : "";
  const viewUrl = `${origin}/i/${shortCode}.${ext}${querySuffix}`;
  const downloadUrl = `${origin}/gallery/download/${shortCode}.${ext}${querySuffix}`;

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const payload = await getImageInfo(shortCode, ext, sign);
        setInfo(payload);
        setFatalError("");
      } catch {
        setFatalError("页面不存在或您的权限不足");
      } finally {
        setLoading(false);
      }
    })();
  }, [shortCode, ext, sign]);

  function fallbackCopyText(text: string): boolean {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "readonly");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let copiedWithFallback = false;
    try {
      copiedWithFallback = document.execCommand("copy");
    } finally {
      document.body.removeChild(textArea);
    }
    return copiedWithFallback;
  }

  async function copyText(text: string, key: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (!fallbackCopyText(text)) {
        throw new Error("clipboard not available");
      }
      setCopied(key);
      setCopyError("");
      window.setTimeout(() => setCopied(""), 1200);
    } catch {
      if (fallbackCopyText(text)) {
        setCopied(key);
        setCopyError("");
        window.setTimeout(() => setCopied(""), 1200);
        return;
      }
      setCopyError("复制失败，请长按文本手动复制");
    }
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">加载中...</div>;
  }

  if (fatalError || !info) {
    return <PublicErrorPage message={fatalError || undefined} />;
  }

  const markdown = `![${info.file_name}](${viewUrl})`;
  const imgTag = `<img src="${viewUrl}" alt="${info.file_name}">`;
  const videoTag = `<video src="${viewUrl}" controls width="500"></video>`;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-8">
      <div className="glass-panel mt-auto rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_16px_40px_rgba(63,35,8,0.12)] sm:p-7">
        <h1 className="truncate text-xl font-semibold sm:text-2xl" title={info.file_name}>{info.file_name}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          大小 {formatFileSize(info.file_size)} · 类型 {info.file_type} · 访问 {info.view_count}
        </p>

        <div className="mt-4 flex max-h-[66vh] min-h-[280px] items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-muted/35 p-2">
          {info.file_type === "video" ? (
            <PlyrVideo src={viewUrl} className="max-h-[66vh] w-full" />
          ) : info.file_type === "image" ? (
            <img src={viewUrl} alt={info.file_name} className="max-h-[66vh] w-auto" />
          ) : (
            <p className="text-sm text-muted-foreground">该文件类型暂不支持预览</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <a className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href={viewUrl} target="_blank" rel="noreferrer">直接访问</a>
          <a className="rounded-xl border border-border/80 bg-white px-4 py-2 text-sm" href={downloadUrl}>下载文件</a>
        </div>

        <div className="mt-5 space-y-2">
          {copyError ? <p className="text-xs text-orange-600">{copyError}</p> : null}
          {info.file_type === "video" ? (
            <CopyItem label="VIDEO" value={videoTag} copied={copied === "video"} onCopy={() => void copyText(videoTag, "video")} />
          ) : (
            <>
              <CopyItem label="Markdown" value={markdown} copied={copied === "md"} onCopy={() => void copyText(markdown, "md")} />
              <CopyItem label="IMG" value={imgTag} copied={copied === "img"} onCopy={() => void copyText(imgTag, "img")} />
            </>
          )}
        </div>
      </div>

      <p className="mt-auto pt-3 text-center text-xs text-muted-foreground">
        powered by <a className="font-semibold text-teal-700 hover:underline" href="https://github.com/ThinkerWen/z-drive" target="_blank" rel="noreferrer noopener">z-drive</a>
      </p>
    </div>
  );
}

export function PublicSharePage({ shareCode }: { shareCode: string }) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fatalError, setFatalError] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<CloudShareAccessResponse | null>(null);

  const initialPassword = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return search.get("password") || "";
  }, []);

  async function accessShare(pass: string, withLoading = false) {
    if (withLoading) {
      setLoading(true);
    }
    setSubmitting(true);
    try {
      const payload = await accessCloudShare(shareCode, pass);
      setData(payload);
      setRequiresPassword(false);
      setFatalError("");
      setPassword(pass);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setRequiresPassword(true);
        setData(null);
        setFatalError("");
      } else if (error instanceof ApiError && error.status === 404) {
        setFatalError("分享不存在或已关闭");
      } else {
        setFatalError(error instanceof Error ? error.message : "分享访问失败");
      }
    } finally {
      setSubmitting(false);
      if (withLoading) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void accessShare(initialPassword, true);
  }, [initialPassword, shareCode]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">加载中...</div>;
  }

  if (fatalError) {
    return <PublicErrorPage message={fatalError} />;
  }

  if (requiresPassword || !data) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-10 sm:px-8">
        <div className="soft-panel w-full rounded-3xl border border-white/70 bg-white/90 p-8 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
          <h1 className="text-2xl font-semibold tracking-tight">访问分享</h1>
          <p className="mt-2 text-sm text-muted-foreground">该分享需要密码，请输入后继续。</p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void accessShare(password);
            }}
          >
            <input
              className="w-full rounded-xl border border-white/80 bg-white/80 px-3 py-2.5 text-sm outline-none ring-offset-2 transition focus-visible:ring-2 focus-visible:ring-primary"
              placeholder="请输入分享密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <ButtonLike disabled={submitting || !password.trim()}>{submitting ? "验证中..." : "进入查看"}</ButtonLike>
          </form>
        </div>
      </div>
    );
  }

  const item = data.item;
  const downloadUrl = data.download_url;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 sm:px-8">
      <div className="glass-panel mt-auto rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_16px_40px_rgba(63,35,8,0.12)] sm:p-7">
        <h1 className="truncate text-xl font-semibold sm:text-2xl" title={item.name}>{item.name}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          分享码 {shareCode} · {item.is_folder ? "目录" : "文件"} · 仅支持通过分享下载
        </p>

        <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-2xl border border-border/70 bg-muted/35 p-6 text-center">
          {item.is_folder ? (
            <p className="text-sm text-muted-foreground">目录分享暂不支持直接下载，请在后台中查看目录内容。</p>
          ) : (
            <p className="text-sm text-muted-foreground">为保护云盘资源，分享页不提供直接访问与在线预览，请使用下载按钮获取文件。</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!item.is_folder ? <a className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" href={downloadUrl}>下载文件</a> : null}
        </div>
      </div>
      <p className="mt-auto pt-3 text-center text-xs text-muted-foreground">
        powered by <a className="font-semibold text-teal-700 hover:underline" href="https://github.com/ThinkerWen/z-drive" target="_blank" rel="noreferrer noopener">z-drive</a>
      </p>
    </div>
  );
}

function ButtonLike({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="w-full rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function CopyItem({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="grid grid-cols-[84px_1fr_auto] items-center gap-2 rounded-xl border border-border/70 bg-muted/35 px-3 py-2 text-xs">
      <span className="font-semibold text-muted-foreground">{label}</span>
      <span className="truncate font-mono" title={value}>{value}</span>
      <button
        type="button"
        className={
          copied
            ? "rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-white"
            : "rounded-md bg-primary px-2.5 py-1 font-semibold text-white"
        }
        onClick={onCopy}
      >
        {copied ? "已复制" : "复制"}
      </button>
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
