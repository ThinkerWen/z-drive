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
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cppLang from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import cssLang from "highlight.js/lib/languages/css";
import goLang from "highlight.js/lib/languages/go";
import javaLang from "highlight.js/lib/languages/java";
import javascriptLang from "highlight.js/lib/languages/javascript";
import jsonLang from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import markdownLang from "highlight.js/lib/languages/markdown";
import phpLang from "highlight.js/lib/languages/php";
import pythonLang from "highlight.js/lib/languages/python";
import ruby from "highlight.js/lib/languages/ruby";
import rustLang from "highlight.js/lib/languages/rust";
import sqlLang from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import typescriptLang from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yamlLang from "highlight.js/lib/languages/yaml";
import "highlight.js/styles/github.css";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cppLang);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("css", cssLang);
hljs.registerLanguage("go", goLang);
hljs.registerLanguage("java", javaLang);
hljs.registerLanguage("javascript", javascriptLang);
hljs.registerLanguage("json", jsonLang);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("markdown", markdownLang);
hljs.registerLanguage("php", phpLang);
hljs.registerLanguage("python", pythonLang);
hljs.registerLanguage("ruby", ruby);
hljs.registerLanguage("rust", rustLang);
hljs.registerLanguage("sql", sqlLang);
hljs.registerLanguage("swift", swift);
hljs.registerLanguage("typescript", typescriptLang);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("yaml", yamlLang);

function normalizeLanguage(language: string): string {
  const value = (language || "").trim().toLowerCase();
  if (!value) {
    return "text";
  }
  if (value === "auto") {
    return "text";
  }
  if (value === "js") {
    return "javascript";
  }
  if (value === "ts") {
    return "typescript";
  }
  if (value === "sh") {
    return "bash";
  }
  return value;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderSnippetWithLineNumbers(codeContent: string, languageHint: string): string {
  const code = codeContent || "";
  const normalized = normalizeLanguage(languageHint);

  const canHighlight = normalized !== "text" && Boolean(hljs.getLanguage(normalized));
  const lines = code.split(/\r?\n/);
  if (lines.length === 0) {
    lines.push("");
  }

  const rows = lines
    .map((line, index) => {
      let content = "";
      if (line.length > 0) {
        if (canHighlight) {
          content = hljs.highlight(line, { language: normalized, ignoreIllegals: true }).value;
        } else {
          content = escapeHtml(line);
        }
      }
      if (!content) {
        content = "&nbsp;";
      }
      return `<div class="snippet-row"><span class="snippet-line-number">${index + 1}</span><span class="snippet-line-content">${content}</span></div>`;
    })
    .join("");

  return `<div class="snippet-highlight-wrap hljs">${rows}</div>`;
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
