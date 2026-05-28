import fs from "node:fs";
import path from "node:path";
import { load } from "cheerio";
import MarkdownIt from "markdown-it";
import TurndownService from "turndown";

export type ArticleSourceType = "markdown" | "github" | "url";
export type ArticleSourceHint = ArticleSourceType | "auto";

export type PrepareWechatArticleOptions = {
  source: string;
  sourceType?: ArticleSourceHint;
  title?: string;
};

export type PreparedWechatArticle = {
  sourceType: ArticleSourceType;
  sourceRef: string;
  markdown: string;
  html: string;
};

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
});

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

turndown.addRule("keepPre", {
  filter: "pre",
  replacement: (_content: string, node: Node) => {
    const text = (node as HTMLElement).textContent ?? "";
    return `\n\`\`\`\n${text}\n\`\`\`\n`;
  },
});

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isGithubUrl(raw: string): boolean {
  if (!isHttpUrl(raw)) return false;
  const u = new URL(raw);
  return u.hostname === "github.com" || u.hostname === "raw.githubusercontent.com";
}

function cleanMarkdown(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function fetchText(url: string, timeoutMs = 30_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} when fetching ${url}`);
    }
    return await resp.text();
  } finally {
    clearTimeout(timer);
  }
}

function getGithubRawCandidates(url: string): string[] {
  const u = new URL(url);
  if (u.hostname === "raw.githubusercontent.com") return [url];

  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return [];
  const owner = parts[0]!;
  const repo = parts[1]!;

  if (parts.length >= 5 && parts[2] === "blob") {
    const branch = parts[3]!;
    const filePath = parts.slice(4).map(decodeURIComponent).join("/");
    return [
      `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`,
    ];
  }

  return [
    `https://raw.githubusercontent.com/${owner}/${repo}/main/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/main/docs/README.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/master/docs/README.md`,
  ];
}

async function fetchGithubMarkdown(url: string): Promise<string> {
  const candidates = getGithubRawCandidates(url);
  if (candidates.length === 0) {
    throw new Error(`Unsupported GitHub URL: ${url}`);
  }
  let lastErr: string | null = null;
  for (const candidate of candidates) {
    try {
      const text = await fetchText(candidate);
      if (text.trim()) return cleanMarkdown(text);
      lastErr = `Empty content from ${candidate}`;
    } catch (error) {
      lastErr = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastErr ?? `Failed to fetch markdown from GitHub URL: ${url}`);
}

function extractReadableHtml(html: string): string {
  const $ = load(html);
  $("script, style, noscript, iframe, svg, canvas").remove();
  const candidates = [
    "article",
    "main",
    '[role="main"]',
    ".markdown-body",
    ".post-content",
    ".entry-content",
    ".article-content",
    "#content",
  ];

  let picked: string | null = null;
  let maxLen = 0;
  for (const selector of candidates) {
    $(selector).each((_, el) => {
      const textLen = $(el).text().trim().length;
      if (textLen > maxLen) {
        maxLen = textLen;
        picked = $.html(el);
      }
    });
  }

  if (picked) return picked;
  return $("body").html() ?? html;
}

async function fetchUrlAsMarkdown(url: string): Promise<string> {
  const html = await fetchText(url);
  const readable = extractReadableHtml(html);
  const md = turndown.turndown(readable);
  return cleanMarkdown(md);
}

function applyStyleBlock(html: string, title?: string): string {
  const $ = load(`<section data-tool="social-publish-skills">${html}</section>`);
  const root = $("section").first();
  root.attr(
    "style",
    [
      "font-family: -apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',Arial,sans-serif",
      "font-size: 16px",
      "line-height: 1.85",
      "color: #1f2328",
      "word-break: break-word",
    ].join(";")
  );

  const addStyle = (selector: string, style: string) => {
    root.find(selector).each((_, el) => {
      const prev = $(el).attr("style");
      $(el).attr("style", prev ? `${prev};${style}` : style);
    });
  };

  addStyle("h1", "font-size: 28px;line-height:1.35;margin:30px 0 16px;font-weight:700");
  addStyle("h2", "font-size: 24px;line-height:1.4;margin:28px 0 14px;font-weight:700");
  addStyle("h3", "font-size: 20px;line-height:1.45;margin:22px 0 10px;font-weight:700");
  addStyle("h4,h5,h6", "font-size: 17px;line-height:1.5;margin:18px 0 8px;font-weight:700");
  addStyle("p", "margin: 0 0 16px");
  addStyle("ul,ol", "margin: 0 0 16px 1.4em;padding:0");
  addStyle("li", "margin: 6px 0");
  addStyle(
    "blockquote",
    "margin: 18px 0;padding:10px 16px;border-left:4px solid #d0d7de;background:#f6f8fa;color:#57606a"
  );
  addStyle(
    "pre",
    "margin:16px 0;padding:14px 16px;background:#0d1117;color:#e6edf3;border-radius:8px;overflow:auto;line-height:1.6"
  );
  addStyle("pre code", "font-family: Menlo,Monaco,'Courier New',monospace;font-size:13px");
  addStyle("code", "font-family: Menlo,Monaco,'Courier New',monospace;background:#f6f8fa;padding:2px 4px;border-radius:4px");
  addStyle("a", "color:#0969da;text-decoration:none");
  addStyle("hr", "border:none;border-top:1px solid #d0d7de;margin:24px 0");
  addStyle(
    "table",
    "border-collapse:collapse;width:100%;margin:16px 0;display:block;overflow:auto"
  );
  addStyle("th,td", "border:1px solid #d0d7de;padding:8px 10px;text-align:left");
  addStyle("img", "display:block;max-width:100%;height:auto;margin:18px auto;border-radius:6px");
  addStyle("figure", "margin:18px 0");
  addStyle("figcaption", "margin-top:6px;font-size:13px;color:#57606a;text-align:center");

  if (title && root.find("h1").length === 0) {
    root.prepend(
      `<h1 style="font-size:28px;line-height:1.35;margin:0 0 16px;font-weight:700">${escapeHtml(
        title
      )}</h1>`
    );
  }

  return root.toString();
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function resolveSourceType(source: string, hint: ArticleSourceHint): ArticleSourceType {
  if (hint !== "auto") return hint;
  if (isGithubUrl(source)) return "github";
  if (isHttpUrl(source)) return "url";
  return "markdown";
}

async function readMarkdownFile(rawPath: string): Promise<string> {
  if (!path.isAbsolute(rawPath)) {
    throw new Error(`Local markdown source must be an absolute path: ${rawPath}`);
  }
  if (!fs.existsSync(rawPath)) {
    throw new Error(`Markdown file not found: ${rawPath}`);
  }
  return cleanMarkdown(await fs.promises.readFile(rawPath, "utf-8"));
}

export async function prepareWechatArticle(
  options: PrepareWechatArticleOptions
): Promise<PreparedWechatArticle> {
  const sourceType = resolveSourceType(options.source, options.sourceType ?? "auto");
  let markdownText: string;
  if (sourceType === "markdown") {
    markdownText = await readMarkdownFile(options.source);
  } else if (sourceType === "github") {
    markdownText = await fetchGithubMarkdown(options.source);
  } else {
    markdownText = await fetchUrlAsMarkdown(options.source);
  }

  const rendered = markdown.render(markdownText);
  const html = applyStyleBlock(rendered, options.title);
  return {
    sourceType,
    sourceRef: options.source,
    markdown: markdownText,
    html,
  };
}
