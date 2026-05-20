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
import { resolveBaijiahaoCookiePath } from "../paths.js";
import { emit } from "../progress.js";
import { type PublishResult } from "../publish-result.js";

const HOME_URL = "https://baijiahao.baidu.com/builder/rc/home";
const ROOT_URL = "https://baijiahao.baidu.com/";
const LOGIN_URL = "https://baijiahao.baidu.com/builder/theme/bjh/login";
const EDITOR_URLS = [
  "https://baijiahao.baidu.com/builder/rc/edit?type=news",
  "https://baijiahao.baidu.com/builder/rc/edit?type=article",
];
const TITLE_SELECTORS = [
  "textarea[placeholder*='标题']",
  "input[placeholder*='标题']",
  "[contenteditable='true'][placeholder*='标题']",
  "[contenteditable='true'][data-placeholder*='标题']",
  ".title-input textarea",
  ".article-title textarea",
];
const BODY_SELECTORS = [
  "iframe",
  ".ProseMirror[contenteditable='true']",
  ".public-DraftEditor-content[contenteditable='true']",
  "[contenteditable='true'][data-placeholder*='正文']",
  "[contenteditable='true'][placeholder*='正文']",
  "[contenteditable='true']",
  "textarea[placeholder*='正文']",
];
const DRAFT_BUTTON_TEXTS = ["保存草稿", "存草稿", "保存"];
const PUBLISH_BUTTON_TEXTS = ["发布", "发表"];
const CONFIRM_BUTTON_TEXTS = ["确认发布", "确认", "确定", "发布"];

export function isBaijiahaoLoginUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.endsWith("baidu.com")) return false;
    return /\/login/.test(url.pathname) || url.hostname.startsWith("passport.");
  } catch {
    return false;
  }
}

export function isBaijiahaoEditorUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.hostname === "baijiahao.baidu.com" && url.pathname.includes("/builder/rc/edit");
  } catch {
    return false;
  }
}

export function isBaijiahaoSafetyVerificationUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.hostname === "wappass.baidu.com") return true;
    if (url.hostname === "passport.baidu.com" && /captcha|verify|vcode/.test(url.pathname)) {
      return true;
    }
    return /captcha|verify|unusual|risk/.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

export function normalizeBaijiahaoArticleUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.hostname !== "baijiahao.baidu.com" || url.pathname !== "/s") return rawUrl;
    const id = url.searchParams.get("id");
    if (!id) return rawUrl;
    url.search = `?id=${encodeURIComponent(id)}`;
    url.hash = "";
    return url.toString();
  } catch {
    return rawUrl;
  }
}

async function firstVisibleLocator(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible().catch(() => false);
    if (visible) return locator;
  }
  return null;
}

async function isSafetyVerificationVisible(page: Page): Promise<boolean> {
  if (isBaijiahaoSafetyVerificationUrl(page.url())) return true;
  const bodyText = await page.locator("body").innerText().catch(() => "");
  return /安全验证|风险验证|环境异常|开始验证|请完成验证|验证码/.test(bodyText);
}

async function waitForSafetyVerificationComplete(page: Page): Promise<void> {
  if (!(await isSafetyVerificationVisible(page))) return;

  console.log("[baijiahao] 检测到安全验证，请在浏览器中完成验证");
  const timeoutMs = 180_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!(await isSafetyVerificationVisible(page))) {
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await sleep(1500);
      console.log("[baijiahao] 安全验证已通过，继续发布流程");
      return;
    }
    await sleep(1000);
  }

  throw new Error("[baijiahao] 等待安全验证超时，请完成验证后重试。");
}

async function isLoginPromptVisible(page: Page): Promise<boolean> {
  if (isBaijiahaoLoginUrl(page.url())) return true;
  const loginTexts = ["扫码登录", "百度帐号登录", "百度账号登录", "登录百度帐号", "登录百度账号"];
  for (const text of loginTexts) {
    const visible = await page.getByText(text, { exact: false }).first().isVisible().catch(() => false);
    if (visible) return true;
  }
  const phoneInput = page
    .locator("input[placeholder*='手机号'], input[placeholder*='用户名'], input[placeholder*='密码'], input[placeholder*='验证码']")
    .first();
  return phoneInput.isVisible().catch(() => false);
}

async function waitForQrCode(page: Page): Promise<void> {
  const scanTab = page.getByText("扫码登录", { exact: false }).first();
  if (await scanTab.isVisible().catch(() => false)) {
    await scanTab.click().catch(() => {});
  }

  const selectors = [
    "canvas",
    "img[alt*='二维码']",
    "img[src*='qrcode']",
    "img[src*='qr']",
    ".qrcode img",
    ".Qrcode img",
    ".login-qrcode img",
  ];
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const qr = page.locator(selector).first();
      if (await qr.isVisible().catch(() => false)) {
        console.log("[baijiahao] 二维码已显示，请使用百度 App 扫码登录");
        return;
      }
    }
    await sleep(500);
  }

  console.warn("[baijiahao] 未识别到二维码；如页面已显示登录控件，请完成登录后继续。");
}

async function waitUntilLoggedIn(page: Page): Promise<void> {
  const timeoutMs = 180_000;
  const start = Date.now();
  let stable = 0;
  console.log("[baijiahao] 正在轮询登录状态，扫码/验证成功后将自动继续...");

  while (Date.now() - start < timeoutMs) {
    await waitForSafetyVerificationComplete(page);
    const onBaijiahao = page.url().includes("baijiahao.baidu.com");
    const loginVisible = await isLoginPromptVisible(page);
    if (onBaijiahao && !loginVisible && !isBaijiahaoLoginUrl(page.url())) {
      stable += 1;
      if (stable >= 3) {
        await sleep(1000);
        console.log("[baijiahao] 已检测到登录成功");
        return;
      }
    } else {
      stable = 0;
    }
    await sleep(600);
  }

  console.warn(
    "[baijiahao] 自动检测登录超时（3 分钟），请改用 Playwright Inspector 点 Resume，或设置 SOCIAL_PUBLISH_LOGIN_STDIN=1 在终端按 Enter"
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
    await waitForSafetyVerificationComplete(page);
    if (await isLoginPromptVisible(page)) return false;
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
  const labels = ["发布文章", "发布内容", "图文", "文章"];
  for (const label of labels) {
    const entry = page.getByText(label, { exact: false }).first();
    if (!(await entry.isVisible().catch(() => false))) continue;
    await entry.click({ force: true }).catch(() => {});
    return true;
  }
  return false;
}

async function openEditor(page: Page): Promise<void> {
  for (const url of EDITOR_URLS) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    await sleep(2000);
    await waitForSafetyVerificationComplete(page);
    if (await isLoginPromptVisible(page)) {
      throw new Error("当前登录态失效，无法进入百家号文章编辑页。");
    }
    if (await waitUntilEditorReady(page, 12_000)) return;
  }

  await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await sleep(1500);
  await waitForSafetyVerificationComplete(page);

  if (await clickArticleEntry(page)) {
    await page.waitForLoadState("domcontentloaded", { timeout: 60_000 }).catch(() => {});
    await sleep(2500);
    if (await waitUntilEditorReady(page, 20_000)) return;
  }

  const diagnostics = await collectEditorDiagnostics(page);
  throw new Error(`未识别到百家号文章编辑器。${diagnostics}`);
}

async function fillTitle(locator: Locator, value: string): Promise<void> {
  await locator.click();
  const isEditable = await locator
    .evaluate((node) => node.getAttribute("contenteditable") === "true")
    .catch(() => false);
  if (isEditable) {
    await locator.evaluate((node, text) => {
      const el = node as HTMLElement;
      el.textContent = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    return;
  }
  await locator.fill(value);
}

async function fillBody(page: Page, locator: Locator, markdown: string, html: string): Promise<void> {
  const tagName = await locator.evaluate((node) => node.tagName.toLowerCase()).catch(() => "");
  if (tagName === "iframe") {
    await locator.evaluate((node, content) => {
      const frame = node as HTMLIFrameElement;
      const body = frame.contentDocument?.body;
      if (!body) return;
      body.innerHTML = content;
      body.dispatchEvent(new Event("input", { bubbles: true }));
      body.dispatchEvent(new Event("change", { bubbles: true }));
    }, html);
    return;
  }

  await locator.click();
  const mod = selectAllModifier();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.insertText(markdown);
}

function stripDuplicateTitle(markdown: string, title: string): string {
  const escaped = title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const heading = new RegExp(`^#\\s+${escaped}\\s*\\n+`, "i");
  return markdown.replace(heading, "").trim();
}

async function fillArticle(page: Page, title: string, markdown: string, html: string): Promise<void> {
  const titleInput = await firstVisibleLocator(page, TITLE_SELECTORS);
  const bodyInput = await firstVisibleLocator(page, BODY_SELECTORS);
  if (!titleInput || !bodyInput) {
    const diagnostics = await collectEditorDiagnostics(page);
    throw new Error(`未识别到标题输入框或正文编辑器。${diagnostics}`);
  }

  await fillTitle(titleInput, title);
  await fillBody(page, bodyInput, markdown, html);
}

async function clickButtonByText(page: Page, labels: string[]): Promise<string | null> {
  for (const label of labels) {
    const button = page
      .locator("button, [role='button'], a")
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
    throw new Error("未找到百家号发布按钮。");
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
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await sleep(1500);
    if (await isSafetyVerificationVisible(page)) return false;
    return !(await isLoginPromptVisible(page));
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
  await waitForSafetyVerificationComplete(page);
  await waitForQrCode(page);
  if (process.env.SOCIAL_PUBLISH_LOGIN_STDIN === "1") {
    await waitForUserLoginComplete(page);
  } else {
    await waitUntilLoggedIn(page);
  }
  await sleep(2000);
  await ctx.storageState({ path: storagePath });
  await browser.close();
}

export type BaijiahaoPublishOptions = {
  account: string;
  source: string;
  sourceType?: ArticleSourceHint;
  title: string;
  publish?: boolean;
};

export async function publishBaijiahaoArticle(
  opts: BaijiahaoPublishOptions
): Promise<PublishResult> {
  const storagePath = resolveBaijiahaoCookiePath(opts.account);
  const total = 8;

  emit(1, total, "INIT", "检查参数");
  emit(1, total, "INIT", "OK", true);

  emit(2, total, "COOKIE_CHECK", "校验百家号登录态");
  let valid = await cookieAuth(storagePath);
  if (!valid) {
    emit(2, total, "COOKIE_CHECK", "失效", false);
    emit(3, total, "COOKIE_REFRESH", "请扫码登录百家号");
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
    emit(5, total, "OPEN_PUBLISH_PAGE", "打开百家号文章编辑页");
    await openEditor(page);

    emit(6, total, "FILL_FORM", "填写文章内容");
    await fillArticle(page, opts.title, body, article.html);
    await sleep(1500);

    emit(7, total, "PUBLISHING", opts.publish ? "发布文章" : "保存草稿");
    if (opts.publish) {
      await clickPublish(page);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
      await sleep(3000);
    } else {
      const used = await clickButtonByText(page, DRAFT_BUTTON_TEXTS);
      if (used) {
        console.log(`[baijiahao] 已点击按钮: ${used}`);
      } else {
        console.log("[baijiahao] 未找到保存草稿按钮，等待编辑器自动保存草稿");
        await sleep(5000);
      }
    }

    await ctx.storageState({ path: storagePath });
    emit(8, total, "DONE", "成功", true);
    return {
      platform: "baijiahao",
      reviewUrl: normalizeBaijiahaoArticleUrl(page.url()),
    };
  } finally {
    await ctx.close();
    await browser.close();
  }
}
