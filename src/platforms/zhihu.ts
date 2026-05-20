import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Locator, type Page } from "playwright";
import { isHeadless, selectAllModifier } from "../config.js";
import {
  applyStealthScript,
  gotoLoginPage,
  launchBrowser,
  waitForUserLoginComplete,
} from "../browser.js";
import { prepareWechatArticle, type ArticleSourceHint } from "../article-format.js";
import { resolveZhihuCookiePath } from "../paths.js";
import { emit } from "../progress.js";
import { type PublishResult } from "../publish-result.js";

const CREATOR_URL = "https://www.zhihu.com/creator";
const LOGIN_URL = "https://www.zhihu.com/signin?next=%2Fcreator";
const WRITE_URLS = [
  "https://zhuanlan.zhihu.com/write",
  "https://www.zhihu.com/creator/content/article",
];
const TITLE_SELECTORS = [
  "textarea[placeholder*='标题']",
  "input[placeholder*='标题']",
  "[contenteditable='true'][placeholder*='标题']",
  "[contenteditable='true'][data-placeholder*='标题']",
  ".WriteIndex-titleInput textarea",
  ".InputLike[contenteditable='true']",
];
const BODY_SELECTORS = [
  ".DraftEditor-editorContainer [contenteditable='true']",
  ".public-DraftEditor-content[contenteditable='true']",
  ".ProseMirror[contenteditable='true']",
  "[contenteditable='true'][data-placeholder*='正文']",
  "[contenteditable='true'][aria-label*='正文']",
  "[contenteditable='true']",
];
const DRAFT_BUTTON_TEXTS = ["保存草稿", "存草稿"];
const PUBLISH_BUTTON_TEXTS = ["发布", "发表"];
const CONFIRM_BUTTON_TEXTS = ["确认发布", "发布", "确定", "确认"];

export function isZhihuLoginUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.endsWith("zhihu.com")) return false;
    return /\/(signin|login|sign_in|oauth\/signin)/.test(url.pathname);
  } catch {
    return false;
  }
}

export function isZhihuWriteUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "zhuanlan.zhihu.com" && url.pathname.startsWith("/write")) {
      return true;
    }
    if (
      url.hostname.endsWith("zhihu.com") &&
      url.pathname.includes("/creator/content/article")
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function isZhihuSafetyVerificationUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.hostname.endsWith("zhihu.com") && url.pathname === "/account/unhuman";
  } catch {
    return false;
  }
}

export function normalizeZhihuArticleUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const zhuanlanArticle =
      url.hostname === "zhuanlan.zhihu.com" && /^\/p\/[^/]+/.test(url.pathname);
    const zhihuArticle =
      url.hostname.endsWith("zhihu.com") && /^\/p\/[^/]+/.test(url.pathname);
    if (!zhuanlanArticle && !zhihuArticle) return rawUrl;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

async function isZhihuSafetyVerificationVisible(page: Page): Promise<boolean> {
  if (isZhihuSafetyVerificationUrl(page.url())) return true;
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return /安全验证|网络环境存在异常|开始验证/.test(bodyText);
}

async function waitForSafetyVerificationComplete(page: Page): Promise<void> {
  if (!(await isZhihuSafetyVerificationVisible(page))) return;

  console.log("[zhihu] 检测到安全验证，请在浏览器中点击“开始验证”并完成验证");
  const timeoutMs = 180_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isZhihuSafetyVerificationVisible(page))) {
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await sleep(1500);
      console.log("[zhihu] 安全验证已通过，继续发布流程");
      return;
    }
    await sleep(1000);
  }

  throw new Error("[zhihu] 等待安全验证超时，请完成验证后重试。");
}

async function firstVisibleLocator(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible().catch(() => false);
    if (visible) return locator;
  }
  return null;
}

async function isZhihuLoginPromptVisible(page: Page): Promise<boolean> {
  if (isZhihuLoginUrl(page.url())) return true;
  const loginDialog = page
    .locator(".SignFlow, .Modal, [role='dialog']")
    .filter({ hasText: /登录|注册|扫码|验证码/ })
    .first();
  if (await loginDialog.isVisible().catch(() => false)) return true;
  const scanLogin = page.getByText("扫码登录", { exact: false }).first();
  if (await scanLogin.isVisible().catch(() => false)) return true;
  const phoneInput = page
    .locator("input[placeholder*='手机号'], input[placeholder*='邮箱'], input[placeholder*='验证码']")
    .first();
  return phoneInput.isVisible().catch(() => false);
}

async function waitForZhihuQrCode(page: Page): Promise<void> {
  const scanTab = page.getByText("扫码登录", { exact: false }).first();
  if (await scanTab.isVisible().catch(() => false)) {
    await scanTab.click().catch(() => {});
  }

  const selectors = [
    "canvas",
    "img[alt*='二维码']",
    "img[src*='qr']",
    "img[src*='qrcode']",
    ".Qrcode img",
    ".QRCode img",
  ];
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const qr = page.locator(selector).first();
      if (await qr.isVisible().catch(() => false)) {
        console.log("[zhihu] 二维码已显示，请使用知乎 App 扫码登录");
        return;
      }
    }
    await sleep(500);
  }

  console.warn("[zhihu] 未识别到二维码；如页面已显示登录控件，请完成登录后继续。");
}

async function waitUntilZhihuLoggedIn(page: Page): Promise<void> {
  const timeoutMs = 180_000;
  const start = Date.now();
  let stable = 0;
  console.log("[zhihu] 正在轮询登录状态，扫码/验证成功后将自动继续...");

  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    const onZhihu = url.includes("zhihu.com");
    const loginVisible = await isZhihuLoginPromptVisible(page);
    if (onZhihu && !loginVisible && !isZhihuLoginUrl(url)) {
      stable += 1;
      if (stable >= 3) {
        await sleep(1000);
        console.log("[zhihu] 已检测到登录成功");
        return;
      }
    } else {
      stable = 0;
    }
    await sleep(600);
  }

  console.warn(
    "[zhihu] 自动检测登录超时（3 分钟），请改用 Playwright Inspector 点 Resume，或设置 SOCIAL_PUBLISH_LOGIN_STDIN=1 在终端按 Enter"
  );
  await waitForUserLoginComplete(page);
}

async function collectEditorDiagnostics(page: Page): Promise<string> {
  const counts: string[] = [];
  for (const selector of TITLE_SELECTORS) {
    const count = await page.locator(selector).count().catch(() => 0);
    counts.push(`${selector}=${count}`);
  }
  for (const selector of BODY_SELECTORS) {
    const count = await page.locator(selector).count().catch(() => 0);
    counts.push(`${selector}=${count}`);
  }
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const title = await page.title().catch(() => "");
  return [
    `url=${page.url()}`,
    title ? `title=${JSON.stringify(title)}` : "",
    counts.join(" ; "),
    bodyText ? `body=${JSON.stringify(bodyText.replace(/\s+/g, " ").slice(0, 240))}` : "",
  ]
    .filter(Boolean)
    .join(" ; ");
}

async function waitUntilEditorReady(page: Page, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  let stable = 0;
  while (Date.now() - start < timeoutMs) {
    if (await isZhihuLoginPromptVisible(page)) return false;
    const title = await firstVisibleLocator(page, TITLE_SELECTORS);
    const body = await firstVisibleLocator(page, BODY_SELECTORS);
    if (title && body) {
      stable += 1;
      if (stable >= 3) return true;
    } else {
      stable = 0;
    }
    await sleep(500);
  }
  return false;
}

async function clickArticleEntry(page: Page): Promise<boolean> {
  const textEntries = [
    page.getByText("写文章", { exact: true }).first(),
    page.getByText("发文章", { exact: true }).first(),
  ];
  for (const entry of textEntries) {
    if (!(await entry.isVisible().catch(() => false))) continue;
    await entry.click({ force: true }).catch(() => {});
    return true;
  }

  const entry = page
    .locator("a, button, [role='button'], div, span")
    .filter({ hasText: /写文章|发文章|创作文章/ })
    .first();
  if (await entry.isVisible().catch(() => false)) {
    await entry.click({ force: true }).catch(() => {});
    return true;
  }

  const createButton = page
    .locator("button, [role='button'], div, span")
    .filter({ hasText: /开始创作|创作/ })
    .first();
  if (await createButton.isVisible().catch(() => false)) {
    await createButton.click({ force: true }).catch(() => {});
    await sleep(1000);
    const article = page.getByText("写文章", { exact: true }).first();
    if (await article.isVisible().catch(() => false)) {
      await article.click({ force: true }).catch(() => {});
      return true;
    }
  }

  return false;
}

async function openWritePage(page: Page): Promise<void> {
  for (const url of WRITE_URLS) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await sleep(2000);
    await waitForSafetyVerificationComplete(page);
    if (await isZhihuLoginPromptVisible(page)) {
      throw new Error("当前登录态失效，无法进入知乎写文章页面。");
    }
    if (await waitUntilEditorReady(page, 12_000)) return;
  }

  await page.goto(CREATOR_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await sleep(1500);
  await waitForSafetyVerificationComplete(page);

  if (await clickArticleEntry(page)) {
    await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
    await sleep(2500);
    if (await waitUntilEditorReady(page, 20_000)) return;
  }

  const diagnostics = await collectEditorDiagnostics(page);
  throw new Error(`未识别到知乎文章编辑器。${diagnostics}`);
}

async function fillLocator(locator: Locator, value: string): Promise<void> {
  await locator.click();
  const isEditable = await locator
    .evaluate((node) => node.getAttribute("contenteditable") === "true")
    .catch(() => false);
  if (!isEditable) {
    await locator.fill(value);
    return;
  }
  await locator.evaluate((node, text) => {
    const el = node as HTMLElement;
    el.focus();
    el.textContent = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

function stripDuplicateTitle(markdown: string, title: string): string {
  const escaped = title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^#\\s+${escaped}\\s*\\n+`, "i");
  return markdown.replace(heading, "").trim();
}

async function fillArticle(page: Page, title: string, body: string): Promise<void> {
  const titleInput = await firstVisibleLocator(page, TITLE_SELECTORS);
  const bodyInput = await firstVisibleLocator(page, BODY_SELECTORS);
  if (!titleInput || !bodyInput) {
    const diagnostics = await collectEditorDiagnostics(page);
    throw new Error(`未识别到标题输入框或正文编辑器。${diagnostics}`);
  }

  await fillLocator(titleInput, title);
  await fillLocator(bodyInput, body);

  const mod = selectAllModifier();
  await bodyInput.click();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.insertText(body);
}

async function clickButtonByText(page: Page, labels: string[]): Promise<string | null> {
  for (const label of labels) {
    const button = page
      .locator("button, [role='button']")
      .filter({ hasText: new RegExp(`^\\s*${label}\\s*$`) })
      .first();
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click({ force: true });
    return label;
  }
  return null;
}

async function clickPublish(page: Page): Promise<void> {
  const used = await clickButtonByText(page, PUBLISH_BUTTON_TEXTS);
  if (!used) {
    throw new Error("未找到知乎发布按钮。");
  }
  await sleep(1500);
  await clickButtonByText(page, CONFIRM_BUTTON_TEXTS).catch(() => null);
}

export async function cookieAuth(storagePath: string): Promise<boolean> {
  if (!fs.existsSync(storagePath)) return false;
  const browser = await launchBrowser(true);
  try {
    const ctx = await browser.newContext({ storageState: storagePath, locale: "zh-CN" });
    await applyStealthScript(ctx);
    const page = await ctx.newPage();
    await page.goto(CREATOR_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await sleep(1500);
    return !(await isZhihuLoginPromptVisible(page));
  } finally {
    await browser.close();
  }
}

export async function loginAndSaveCookie(storagePath: string): Promise<void> {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const browser = await launchBrowser(false);
  const ctx = await browser.newContext({ locale: "zh-CN", viewport: { width: 1366, height: 900 } });
  await applyStealthScript(ctx);
  const page = await ctx.newPage();
  await gotoLoginPage(page, LOGIN_URL);
  await waitForZhihuQrCode(page);
  if (process.env.SOCIAL_PUBLISH_LOGIN_STDIN === "1") {
    await waitForUserLoginComplete(page);
  } else {
    await waitUntilZhihuLoggedIn(page);
  }
  await sleep(2000);
  await ctx.storageState({ path: storagePath });
  await browser.close();
}

export type ZhihuPublishOptions = {
  account: string;
  source: string;
  sourceType?: ArticleSourceHint;
  title: string;
  publish?: boolean;
};

export async function publishZhihuArticle(
  opts: ZhihuPublishOptions
): Promise<PublishResult> {
  const storagePath = resolveZhihuCookiePath(opts.account);
  const total = 8;

  emit(1, total, "INIT", "检查参数");
  emit(1, total, "INIT", "OK", true);

  emit(2, total, "COOKIE_CHECK", "校验知乎登录态");
  let valid = await cookieAuth(storagePath);
  if (!valid) {
    emit(2, total, "COOKIE_CHECK", "失效", false);
    emit(3, total, "COOKIE_REFRESH", "请扫码登录知乎");
    await loginAndSaveCookie(storagePath);
    valid = await cookieAuth(storagePath);
    if (!valid) throw new Error("Cookie still invalid after login");
    emit(3, total, "COOKIE_REFRESH", "OK", true);
  } else {
    emit(2, total, "COOKIE_CHECK", "有效", true);
  }

  emit(4, total, "CONTENT_PREPARE", "抓取并格式化文章内容");
  const article = await prepareWechatArticle({
    source: opts.source,
    sourceType: opts.sourceType ?? "auto",
    title: opts.title,
  });
  const body = stripDuplicateTitle(article.markdown, opts.title);
  emit(4, total, "CONTENT_PREPARE", `来源: ${article.sourceType}`, true);

  const browser = await launchBrowser(isHeadless());
  const ctx = await browser.newContext({ storageState: storagePath, locale: "zh-CN" });
  await applyStealthScript(ctx);
  const page = await ctx.newPage();

  try {
    emit(5, total, "OPEN_PUBLISH_PAGE", "打开知乎写文章页面");
    await openWritePage(page);

    emit(6, total, "FILL_FORM", "填写文章内容");
    await fillArticle(page, opts.title, body);
    await sleep(1500);

    emit(7, total, "PUBLISHING", opts.publish ? "发布文章" : "保存草稿");
    if (opts.publish) {
      await clickPublish(page);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await sleep(3000);
    } else {
      const used = await clickButtonByText(page, DRAFT_BUTTON_TEXTS);
      if (used) {
        console.log(`[zhihu] 已点击按钮: ${used}`);
      } else {
        console.log("[zhihu] 未找到保存草稿按钮，等待编辑器自动保存草稿");
        await sleep(5000);
      }
    }

    await ctx.storageState({ path: storagePath });
    emit(8, total, "DONE", "成功", true);
    return {
      platform: "zhihu",
      reviewUrl: normalizeZhihuArticleUrl(page.url()),
    };
  } finally {
    await ctx.close();
    await browser.close();
  }
}
