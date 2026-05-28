import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Locator, type Page } from "playwright";
import { selectAllModifier } from "../config.js";
import {
  applyStealthScript,
  gotoLoginPage,
  launchBrowser,
  waitForUserLoginComplete,
} from "../browser.js";
import { emit } from "../progress.js";
import { resolveXiaohongshuCookiePath } from "../paths.js";
import { type PublishResult } from "../publish-result.js";

const CREATOR_URL = "https://creator.xiaohongshu.com/";
const LOGIN_URL = "https://creator.xiaohongshu.com/login";
const PUBLISH_URL = "https://creator.xiaohongshu.com/publish/publish";
const TITLE_SELECTORS = [
  "input[placeholder*='标题']",
  "textarea[placeholder*='标题']",
  "[contenteditable='true'][placeholder*='标题']",
  "[contenteditable='true'][data-placeholder*='标题']",
];
const DESC_SELECTORS = [
  "textarea[placeholder*='正文']",
  "textarea[placeholder*='描述']",
  "textarea[placeholder*='分享']",
  "[contenteditable='true'][data-placeholder*='正文']",
  "[contenteditable='true'][placeholder*='正文']",
  "[contenteditable='true']",
];
const PUBLISH_BUTTON_TEXTS = ["发布", "立即发布"];
const SCHEDULE_BUTTON_TEXTS = ["定时发布"];
type UploadMode = "video" | "note";

export type XiaohongshuVideoOptions = {
  account: string;
  videoFile: string;
  title: string;
  description?: string;
  tags: string[];
  schedule?: Date | null;
};

export type XiaohongshuNoteOptions = {
  account: string;
  images: string[];
  title: string;
  note?: string;
  tags: string[];
  schedule?: Date | null;
};

export function isXiaohongshuLoginUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.hostname.endsWith("xiaohongshu.com") && /login|signin/.test(url.pathname);
  } catch {
    return false;
  }
}

export function isXiaohongshuPublishUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return (
      url.hostname === "creator.xiaohongshu.com" &&
      url.pathname.includes("/publish")
    );
  } catch {
    return false;
  }
}

export function parseXiaohongshuTags(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

export function buildXiaohongshuDescriptionSelectors(
  titleSelector?: string | null
): string[] {
  const selectors = DESC_SELECTORS.filter((selector) => selector !== titleSelector);
  if (titleSelector?.includes("[contenteditable='true']")) {
    return selectors.filter((selector) => selector !== "[contenteditable='true']");
  }
  return selectors;
}

type XiaohongshuUploadWaitState = {
  sawProcessing: boolean;
  readyPolls: number;
};

type XiaohongshuUploadWaitInput = {
  pageText: string;
  sawProcessing: boolean;
  fileInputVisible: boolean;
  readyPolls: number;
};

const PROCESSING_TEXT_RE = /上传中|处理中|上传完成前|校验中|处理中，请稍候/;
const PUBLISH_ACTION_RE = /发布|立即发布|定时发布/;
const READY_POLLS_THRESHOLD = 2;

export function shouldXiaohongshuWaitForUpload(input: XiaohongshuUploadWaitInput): boolean {
  const { pageText, sawProcessing, fileInputVisible, readyPolls } = input;
  const hasPublishAction = PUBLISH_ACTION_RE.test(pageText);
  const hasProcessing = PROCESSING_TEXT_RE.test(pageText);
  if (!hasPublishAction) return true;
  if (hasProcessing) return true;
  if (sawProcessing) return readyPolls < READY_POLLS_THRESHOLD;
  if (fileInputVisible) return true;
  return readyPolls < READY_POLLS_THRESHOLD;
}

export function getXiaohongshuUploadWaitState(
  prev: XiaohongshuUploadWaitState,
  pageText: string,
  fileInputVisible: boolean
): XiaohongshuUploadWaitState {
  const hasProcessing = PROCESSING_TEXT_RE.test(pageText);
  const sawProcessing = prev.sawProcessing || hasProcessing;
  const hasPublishAction = PUBLISH_ACTION_RE.test(pageText);
  const isReadyCandidate = hasPublishAction && !hasProcessing && (sawProcessing || !fileInputVisible);
  const readyPolls = isReadyCandidate ? prev.readyPolls + 1 : 0;
  return { sawProcessing, readyPolls };
}

export function requireAbsoluteLocalPath(rawPath: string, label: string): string {
  if (!path.isAbsolute(rawPath)) {
    throw new Error(`${label} must be an absolute path: ${rawPath}`);
  }
  if (!fs.existsSync(rawPath)) {
    throw new Error(`${label} not found: ${rawPath}`);
  }
  return rawPath;
}

async function firstVisibleLocator(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return locator;
  }
  return null;
}

async function firstVisibleLocatorEntry(
  page: Page,
  selectors: string[]
): Promise<{ selector: string; locator: Locator } | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.isVisible().catch(() => false)) return { selector, locator };
  }
  return null;
}

async function isLoginPromptVisible(page: Page): Promise<boolean> {
  if (isXiaohongshuLoginUrl(page.url())) return true;
  for (const text of ["扫码登录", "登录小红书", "手机号登录", "验证码登录"]) {
    if (await page.getByText(text, { exact: false }).first().isVisible().catch(() => false)) {
      return true;
    }
  }
  return page
    .locator("input[placeholder*='手机号'], input[placeholder*='验证码']")
    .first()
    .isVisible()
    .catch(() => false);
}

async function waitForQrCode(page: Page): Promise<void> {
  const selectors = [
    "canvas",
    "img[alt*='二维码']",
    "img[src*='qrcode']",
    "img[src*='qr']",
    ".qrcode img",
    ".login-qrcode img",
  ];
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const selector of selectors) {
      const qr = page.locator(selector).first();
      if (await qr.isVisible().catch(() => false)) {
        console.log("[xiaohongshu] 二维码已显示，请使用小红书 App 扫码登录");
        return;
      }
    }
    await sleep(500);
  }
  console.warn("[xiaohongshu] 未识别到二维码；如页面已显示登录控件，请完成登录后继续。");
}

async function waitUntilLoggedIn(page: Page): Promise<void> {
  const timeoutMs = 180_000;
  const start = Date.now();
  let stable = 0;
  console.log("[xiaohongshu] 正在轮询登录状态，扫码/验证成功后将自动继续...");

  while (Date.now() - start < timeoutMs) {
    const onCreator = page.url().includes("creator.xiaohongshu.com");
    const loginVisible = await isLoginPromptVisible(page);
    if (onCreator && !loginVisible && !isXiaohongshuLoginUrl(page.url())) {
      stable += 1;
      if (stable >= 3) {
        await sleep(800);
        console.log("[xiaohongshu] 已检测到登录成功");
        return;
      }
    } else {
      stable = 0;
    }
    await sleep(600);
  }

  console.warn(
    "[xiaohongshu] 自动检测登录超时（3 分钟），请改用 Playwright Inspector 点 Resume，或设置 SOCIAL_PUBLISH_LOGIN_STDIN=1 在终端按 Enter"
  );
  await waitForUserLoginComplete(page);
}

export async function cookieAuth(storagePath: string): Promise<boolean> {
  if (!fs.existsSync(storagePath)) return false;
  const browser = await launchBrowser(true);
  try {
    const ctx = await browser.newContext({ storageState: storagePath, locale: "zh-CN" });
    await applyStealthScript(ctx);
    const page = await ctx.newPage();
    await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(3000);
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

async function collectDiagnostics(page: Page): Promise<string> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const title = await page.title().catch(() => "");
  const counts: string[] = [];
  for (const selector of [...TITLE_SELECTORS, ...DESC_SELECTORS, 'input[type="file"]']) {
    const count = await page.locator(selector).count().catch(() => 0);
    counts.push(`${selector}=${count}`);
  }
  const buttonTexts = await page
    .locator("button, [role='button']")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => (node.textContent ?? "").replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .slice(0, 20)
    )
    .catch(() => []);
  return [
    `url=${page.url()}`,
    title ? `title=${JSON.stringify(title)}` : "",
    counts.join(" ; "),
    buttonTexts.length > 0 ? `buttons=${JSON.stringify(buttonTexts)}` : "",
    bodyText ? `body=${JSON.stringify(bodyText.replace(/\s+/g, " ").slice(0, 260))}` : "",
  ]
    .filter(Boolean)
    .join(" ; ");
}

async function handleInPageLogin(page: Page, storagePath: string): Promise<void> {
  if (!(await isLoginPromptVisible(page))) return;
  console.log("[xiaohongshu] 发布页需要登录，请扫码/验证");
  await waitForQrCode(page).catch(() => {});
  await waitUntilLoggedIn(page);
  await page.context().storageState({ path: storagePath });
  await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await sleep(2500);
}

async function openPublishPage(page: Page, storagePath: string): Promise<void> {
  await page.goto(PUBLISH_URL, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await sleep(2500);
  await handleInPageLogin(page, storagePath);
}

async function clickTab(page: Page, mode: UploadMode): Promise<void> {
  const labels =
    mode === "video"
      ? ["上传视频", "视频"]
      : ["上传图文", "图文", "图片"];
  for (const label of labels) {
    const tabs = page
      .locator("button, [role='tab'], [role='button'], div, span")
      .filter({ hasText: new RegExp(label) });
    const count = await tabs.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      if (!(await tab.isVisible().catch(() => false))) continue;
      await tab.click({ force: true }).catch(() => {});
      await sleep(1000);
      if (await modeLooksActive(page, mode)) return;
    }
  }
}

async function modeLooksActive(page: Page, mode: UploadMode): Promise<boolean> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  if (mode === "note") {
    return /上传图文|写长文|图片|上传图片/.test(bodyText) && !/请先切换到图片tab/.test(bodyText);
  }
  return /上传视频|视频大小|视频格式/.test(bodyText);
}

async function waitForFileInput(page: Page, mode: UploadMode): Promise<Locator> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const inputs = page.locator('input[type="file"]');
    const count = await inputs.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const fileInput = inputs.nth(i);
      const accept = (await fileInput.getAttribute("accept").catch(() => "")) ?? "";
      if (mode === "note" && /image/i.test(accept)) return fileInput;
      if (mode === "video" && /video/i.test(accept)) return fileInput;
    }
    if (count > 0) {
      const fallback = inputs.first();
      if (await fallback.isVisible().catch(() => true)) return fallback;
    }
    await sleep(500);
  }
  const diagnostics = await collectDiagnostics(page);
  throw new Error(`等待上传控件超时。${diagnostics}`);
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
    el.textContent = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function fillTitleAndDescription(
  page: Page,
  title: string,
  description: string,
  tags: string[]
): Promise<void> {
  const titleEntry = await firstVisibleLocatorEntry(page, TITLE_SELECTORS);
  if (!titleEntry) {
    const diagnostics = await collectDiagnostics(page);
    throw new Error(`未识别到小红书标题输入框。${diagnostics}`);
  }
  await fillLocator(titleEntry.locator, title);

  const descInput = await firstVisibleLocator(
    page,
    buildXiaohongshuDescriptionSelectors(titleEntry.selector)
  );
  if (descInput) {
    await descInput.click();
    const mod = selectAllModifier();
    await page.keyboard.press(`${mod}+A`);
    await page.keyboard.insertText(description);
    for (const tag of tags) {
      await page.keyboard.insertText(` #${tag}`);
    }
  }
}

async function setSchedule(page: Page, dt: Date): Promise<void> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const formatted = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  await clickButtonByText(page, SCHEDULE_BUTTON_TEXTS);
  await sleep(800);
  const input = page.locator("input[placeholder*='时间'], input[placeholder*='日期']").first();
  if (await input.isVisible().catch(() => false)) {
    await input.click();
    await page.keyboard.press(`${selectAllModifier()}+A`);
    await page.keyboard.insertText(formatted);
    await page.keyboard.press("Enter");
  }
}

async function clickButtonByText(page: Page, labels: string[]): Promise<string | null> {
  for (const label of labels) {
    const button = page
      .locator("button, [role='button'], div, span")
      .filter({ hasText: new RegExp(label) })
      .first();
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click({ force: true });
    return label;
  }
  return null;
}

async function clickPublish(page: Page): Promise<void> {
  await page.mouse.wheel(0, 1200).catch(() => {});
  await sleep(500);
  let used = await clickButtonByText(page, PUBLISH_BUTTON_TEXTS);
  if (!used) {
    const exactButtons = page.locator("button").filter({ hasText: /发布|立即发布|发布笔记/ });
    const count = await exactButtons.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      const button = exactButtons.nth(i);
      if (!(await button.isVisible().catch(() => false))) continue;
      await button.scrollIntoViewIfNeeded().catch(() => {});
      await button.click({ force: true }).catch(() => {});
      used = "button:发布";
      break;
    }
  }
  if (!used) {
    const diagnostics = await collectDiagnostics(page);
    throw new Error(`未找到小红书发布按钮。${diagnostics}`);
  }
  await sleep(2500);
}

async function waitForUploadReady(page: Page): Promise<void> {
  const deadline = Date.now() + 300_000;
  let state: XiaohongshuUploadWaitState = { sawProcessing: false, readyPolls: 0 };
  while (Date.now() < deadline) {
    const text = await page.locator("body").innerText().catch(() => "");
    const fileInputVisible = await page
      .locator('input[type="file"]')
      .first()
      .isVisible()
      .catch(() => false);
    state = getXiaohongshuUploadWaitState(state, text, fileInputVisible);
    if (!shouldXiaohongshuWaitForUpload({
      pageText: text,
      sawProcessing: state.sawProcessing,
      fileInputVisible,
      readyPolls: state.readyPolls,
    })) {
      return;
    }
    await sleep(1500);
  }
  const diagnostics = await collectDiagnostics(page);
  throw new Error(`等待小红书上传完成超时。${diagnostics}`);
}

export async function publishXiaohongshuVideo(
  opts: XiaohongshuVideoOptions
): Promise<PublishResult> {
  const storagePath = resolveXiaohongshuCookiePath(opts.account);
  const videoPath = requireAbsoluteLocalPath(opts.videoFile, "video");
  const total = 8;

  emit(1, total, "INIT", "检查参数");
  emit(1, total, "INIT", "OK", true);
  emit(2, total, "COOKIE_CHECK", "校验小红书登录态");
  if (!(await cookieAuth(storagePath))) {
    emit(2, total, "COOKIE_CHECK", "失效", false);
    emit(3, total, "COOKIE_REFRESH", "请扫码登录小红书");
    await loginAndSaveCookie(storagePath);
    emit(3, total, "COOKIE_REFRESH", "OK", true);
  } else {
    emit(2, total, "COOKIE_CHECK", "有效", true);
  }

  const browser = await launchBrowser(false);
  const ctx = await browser.newContext({ storageState: storagePath, locale: "zh-CN" });
  await applyStealthScript(ctx);
  const page = await ctx.newPage();
  try {
    emit(4, total, "OPEN_PUBLISH_PAGE", "打开小红书发布页");
    await openPublishPage(page, storagePath);
    await clickTab(page, "video");
    emit(5, total, "UPLOAD_START", path.basename(videoPath));
    await (await waitForFileInput(page, "video")).setInputFiles(videoPath);
    await fillTitleAndDescription(page, opts.title, opts.description ?? opts.title, opts.tags);
    emit(6, total, "UPLOAD_TRANSFERRING", "等待上传/处理完成");
    await waitForUploadReady(page);
    if (opts.schedule) await setSchedule(page, opts.schedule);
    emit(7, total, "PUBLISHING", "发布");
    await clickPublish(page);
    await ctx.storageState({ path: storagePath });
    emit(8, total, "DONE", "成功", true);
    return { platform: "xiaohongshu", reviewUrl: page.url() };
  } finally {
    await ctx.close();
    await browser.close();
  }
}

export async function publishXiaohongshuNote(
  opts: XiaohongshuNoteOptions
): Promise<PublishResult> {
  const storagePath = resolveXiaohongshuCookiePath(opts.account);
  if (opts.images.length === 0) throw new Error("At least one image is required");
  const imagePaths = opts.images.map((image) => requireAbsoluteLocalPath(image, "image"));
  const total = 8;

  emit(1, total, "INIT", "检查参数");
  emit(1, total, "INIT", "OK", true);
  emit(2, total, "COOKIE_CHECK", "校验小红书登录态");
  if (!(await cookieAuth(storagePath))) {
    emit(2, total, "COOKIE_CHECK", "失效", false);
    emit(3, total, "COOKIE_REFRESH", "请扫码登录小红书");
    await loginAndSaveCookie(storagePath);
    emit(3, total, "COOKIE_REFRESH", "OK", true);
  } else {
    emit(2, total, "COOKIE_CHECK", "有效", true);
  }

  const browser = await launchBrowser(false);
  const ctx = await browser.newContext({ storageState: storagePath, locale: "zh-CN" });
  await applyStealthScript(ctx);
  const page = await ctx.newPage();
  try {
    emit(4, total, "OPEN_PUBLISH_PAGE", "打开小红书发布页");
    await openPublishPage(page, storagePath);
    await clickTab(page, "note");
    emit(5, total, "UPLOAD_START", `${imagePaths.length} 张图片`);
    await (await waitForFileInput(page, "note")).setInputFiles(imagePaths);
    await fillTitleAndDescription(page, opts.title, opts.note ?? opts.title, opts.tags);
    emit(6, total, "UPLOAD_TRANSFERRING", "等待上传完成");
    await waitForUploadReady(page);
    if (opts.schedule) await setSchedule(page, opts.schedule);
    emit(7, total, "PUBLISHING", "发布");
    await clickPublish(page);
    await ctx.storageState({ path: storagePath });
    emit(8, total, "DONE", "成功", true);
    return { platform: "xiaohongshu", reviewUrl: page.url() };
  } finally {
    await ctx.close();
    await browser.close();
  }
}
