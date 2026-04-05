import { useEffect, useMemo, useState } from "react";

import { PlyrVideo } from "@/components/plyr-video";
import { getImageInfo } from "@/lib/api";
import type { ImageInfoResponse } from "@/lib/types";

export function parsePublicPreviewPath(pathname: string): { shortCode: string; ext: string } | null {
  const matched = pathname.match(/^\/gallery\/preview\/([^/.]+)\.([A-Za-z0-9]+)$/);
  if (!matched) {
    return null;
  }
  return { shortCode: matched[1], ext: matched[2] };
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
