import { useEffect, useState } from "react";
import { createHighlighter, isPlainLang, type Highlighter } from "shiki";
import type { Extension } from "@codemirror/state";
import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";

const SHIKI_LANGUAGES = [
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "json",
  "kotlin",
  "markdown",
  "php",
  "python",
  "ruby",
  "rust",
  "sql",
  "swift",
  "typescript",
  "xml",
  "yaml",
];

const LIGHT_THEME = "github-light-default";
const DARK_THEME = "github-dark-default";

let highlighter: Highlighter | null = null;
let highlighterLoaded = false;

const highlighterPromise = createHighlighter({
  themes: [LIGHT_THEME, DARK_THEME],
  langs: SHIKI_LANGUAGES,
}).then((h) => {
  highlighter = h;
  highlighterLoaded = true;
});

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  sh: "bash",
  shell: "bash",
  "c++": "cpp",
  "c#": "csharp",
  cs: "csharp",
  py: "python",
  rb: "ruby",
  rs: "rust",
  md: "markdown",
  yml: "yaml",
};

function normalizeLanguage(language: string): string {
  const value = (language || "").trim().toLowerCase();
  if (!value || value === "auto" || value === "text") {
    return "plaintext";
  }
  return LANGUAGE_ALIASES[value] || value;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderFallback(code: string): string {
  const lines = (code || "").split(/\r?\n/);
  if (lines.length === 0) lines.push("");
  const rows = lines
    .map(
      (line, i) =>
        `<div class="snippet-row"><span class="snippet-line-number">${i + 1}</span><span class="snippet-line-content">${escapeHtml(line) || "&nbsp;"}</span></div>`
    )
    .join("");
  return `<div class="snippet-highlight-wrap">${rows}</div>`;
}

function renderWithShiki(code: string, language: string): string {
  const normalized = normalizeLanguage(language);

  if (normalized === "plaintext" || isPlainLang(normalized)) {
    return renderFallback(code);
  }

  if (!highlighter) {
    return renderFallback(code);
  }

  const loadedLangs = highlighter.getLoadedLanguages();
  if (!loadedLangs.includes(normalized)) {
    return renderFallback(code);
  }

  let html: string;
  try {
    html = highlighter.codeToHtml(code || "\n", {
      lang: normalized,
      themes: { light: LIGHT_THEME, dark: DARK_THEME },
      defaultColor: false,
    });
  } catch {
    return renderFallback(code);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const lines = doc.querySelectorAll(".line");

  if (lines.length === 0) {
    return renderFallback(code);
  }

  const preEl = doc.querySelector("pre");
  const preStyle = preEl?.getAttribute("style") || "";

  const rows = Array.from(lines).map((line, i) => {
    const content = line.innerHTML || "&nbsp;";
    return `<div class="snippet-row"><span class="snippet-line-number">${i + 1}</span><span class="snippet-line-content">${content}</span></div>`;
  });

  return `<div class="snippet-highlight-wrap"${preStyle ? ` style="${preStyle}"` : ""}>${rows.join("")}</div>`;
}

export function renderSnippetWithLineNumbers(codeContent: string, languageHint: string): string {
  if (!highlighter) {
    return renderFallback(codeContent);
  }
  return renderWithShiki(codeContent, languageHint);
}

export function useSnippetHighlight(codeContent: string, languageHint: string): string {
  const [html, setHtml] = useState(() => renderSnippetWithLineNumbers(codeContent, languageHint));

  useEffect(() => {
    let cancelled = false;
    const update = () => {
      if (!cancelled) {
        setHtml(renderSnippetWithLineNumbers(codeContent, languageHint));
      }
    };
    if (highlighterLoaded) {
      update();
    } else {
      highlighterPromise.then(update);
    }
    return () => {
      cancelled = true;
    };
  }, [codeContent, languageHint]);

  return html;
}

export function snippetEditorExtensions(languageHint: string): Extension[] {
  const normalized = normalizeLanguage(languageHint);

  if (normalized === "python") {
    return [python()];
  }
  if (normalized === "javascript") {
    return [javascript()];
  }
  if (normalized === "typescript") {
    return [javascript({ typescript: true })];
  }
  if (normalized === "java") {
    return [java()];
  }
  if (normalized === "go") {
    return [go()];
  }
  if (normalized === "rust") {
    return [rust()];
  }
  if (normalized === "c" || normalized === "cpp") {
    return [cpp()];
  }
  if (normalized === "php") {
    return [php()];
  }
  if (normalized === "sql") {
    return [sql()];
  }
  if (normalized === "json") {
    return [json()];
  }
  if (normalized === "markdown") {
    return [markdown()];
  }
  if (normalized === "html") {
    return [html()];
  }
  if (normalized === "css") {
    return [css()];
  }
  if (normalized === "yaml") {
    return [yaml()];
  }

  return [];
}