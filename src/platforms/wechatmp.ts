import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Locator, type Page } from "playwright";
import { isHeadless } from "../config.js";
import {
  gotoLoginPage,
  waitForUserLoginComplete,
} from "../browser.js";
import { prepareWechatArticle, type ArticleSourceHint } from "../article-format.js";
import { resolveWechatmpCookiePath } from "../paths.js";
import { emit } from "../progress.js";
import { type PublishResult } from "../publish-result.js";

const ROOT_URL = "https://mp.weixin.qq.com/";
const LOGIN_URL = "https://mp.weixin.qq.com/cgi-bin/loginpage?t=wxm2-login&lang=zh_CN";
const DRAFT_BUTTON_TEXTS = ["保存为草稿", "保存草稿", "保存", "另存为草稿"];
const PUBLISH_BUTTON_TEXTS = ["发布", "发表", "群发"];
const SESSION_EXPIRED_TEXTS = [
  "登录超时",
  "请重新登录",
  "请在微信客户端",
  "请使用微信扫一扫登录",
];

function qrcodeSelectors(): string[] {
  return [
    '.login__type__container__scan__qrcode',
    'img[src*="scanloginqrcode"]',
    ".qrcode_panel img",
    'img[alt*="二维码"]',
  ];
}

async function launchWechatBrowser(headless: boolean) {
  // Keep WeChat flows on bundled Chromium and avoid extra page tampering.
  // The login page is fragile: synthetic clicks or init-script mutations can
  // push it into intermediate/non-standard render states on some machines.
  return chromium.launch({ headless });
}

function includesLoginHint(url: string): boolean {
  return url.includes("/cgi-bin/readtemplate") || url.includes("action=login");
}

export function extractWechatToken(url: string): string | null {
  try {
    return new URL(url).searchParams.get("token");
  } catch {
    return null;
  }
}

export function hasAuthenticatedBackendUrl(url: string): boolean {
  return url.includes("/cgi-bin/") && !includesLoginHint(url) && !!extractWechatToken(url);
}

async function isLoginPromptVisible(page: Page): Promise<boolean> {
  const hints = [
    "扫码登录",
    "使用微信扫一扫",
    "公众平台账号登录",
    "使用账号登录",
    ...SESSION_EXPIRED_TEXTS,
  ];
  for (const text of hints) {
    const visible = await page
      .getByText(text, { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return true;
  }
  return false;
}

async function isSessionExpired(page: Page): Promise<boolean> {
  for (const text of SESSION_EXPIRED_TEXTS) {
    const visible = await page
      .getByText(text, { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) return true;
  }
  return false;
}

async function waitUntilWechatMpLoggedIn(page: Page): Promise<string> {
  const timeoutMs = 180_000;
  const pollMs = 600;
  const needStable = 3;
  const start = Date.now();
  let stable = 0;
  let lastAuthedUrl: string | null = null;
  console.log("[wechatmp] 请使用微信扫码登录公众号后台");

  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    const hasLoginHint = await isLoginPromptVisible(page);
    if (hasAuthenticatedBackendUrl(url) && !hasLoginHint) {
      lastAuthedUrl = url;
      stable += 1;
      if (stable >= needStable) {
        await sleep(1000);
        console.log(`[wechatmp] 已检测到登录成功: ${lastAuthedUrl}`);
        return lastAuthedUrl;
      }
    } else {
      lastAuthedUrl = null;
      stable = 0;
    }
    await sleep(pollMs);
  }

  throw new Error(
    "[wechatmp] 自动检测登录超时（3 分钟）。请确认扫码后重试；如需手动确认，可设置 SOCIAL_PUBLISH_LOGIN_STDIN=1 并在登录后按 Enter。"
  );
}

async function resolveAuthenticatedBackendUrl(
  page: Page,
  timeoutMs: number
): Promise<string | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    if (hasAuthenticatedBackendUrl(url)) return url;
    if (includesLoginHint(url) || (await isSessionExpired(page))) return null;
    await sleep(500);
  }
  return null;
}

async function stabilizeAuthenticatedPage(
  page: Page,
  timeoutMs: number
): Promise<string | null> {
  const currentUrl = page.url();
  if (hasAuthenticatedBackendUrl(currentUrl)) {
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await sleep(1500);
    if (!(await isLoginPromptVisible(page)) && !(await isSessionExpired(page))) {
      return page.url();
    }
  }
  return resolveAuthenticatedBackendUrl(page, timeoutMs);
}

async function gotoAuthedBackendRoot(page: Page, timeoutMs: number): Promise<string | null> {
  await page.goto(ROOT_URL, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  return resolveAuthenticatedBackendUrl(page, timeoutMs);
}

async function waitForWechatQrCode(
  page: Page,
  blockedByClientUrls: string[]
): Promise<void> {
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const scanHintMissing = !/微信扫一扫|扫码登录|公众平台账号登录/.test(bodyText);
  if (scanHintMissing || page.url().includes("/cgi-bin/readtemplate")) {
    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await sleep(1200);
  }

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    for (const selector of qrcodeSelectors()) {
      const node = page.locator(selector).first();
      const visible = await node.isVisible().catch(() => false);
      if (visible) return;
    }
    await sleep(500);
  }

  const url = page.url();
  const blocked = blockedByClientUrls.slice(0, 3).join(", ");
  const blockedHint = blocked
    ? ` 可能被客户端拦截的请求: ${blocked}`
    : " 未捕获到 ERR_BLOCKED_BY_CLIENT 请求。";
  throw new Error(
    `[wechatmp] 登录页未显示二维码（URL: ${url}）。${blockedHint} 建议关闭广告拦截类插件/网络过滤后重试。`
  );
}

async function firstVisibleLocator(page: Page, selectors: string[]): Promise<Locator | null> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible().catch(() => false);
    if (visible) return locator;
  }
  return null;
}

async function fillIfPresent(page: Page, selectors: string[], value?: string): Promise<void> {
  if (!value?.trim()) return;
  const locator = await firstVisibleLocator(page, selectors);
  if (!locator) return;
  await locator.click();
  await locator.fill(value.trim());
}

async function setEditorHtml(page: Page, html: string): Promise<void> {
  const result = await page.evaluate((content) => {
    const iframes = Array.from(document.querySelectorAll("iframe"));
    const candidates = iframes.filter((frame) => {
      const sig = `${frame.id} ${frame.name} ${frame.className}`.toLowerCase();
      if (sig.includes("ueditor") || sig.includes("editor") || sig.includes("rich")) return true;
      const src = frame.getAttribute("src")?.toLowerCase() ?? "";
      return src.includes("appmsg") || src.includes("editor");
    });
    const pick = (candidates.length > 0 ? candidates : iframes).find((frame) => {
      const doc = frame.contentDocument;
      return !!doc?.body;
    });
    if (!pick?.contentDocument?.body) {
      const editable = document.querySelector('[contenteditable="true"]') as HTMLElement | null;
      if (editable) {
        editable.innerHTML = content;
        editable.dispatchEvent(new Event("input", { bubbles: true }));
        return { ok: true, mode: "contenteditable" };
      }
      return { ok: false, reason: "editor_not_found" };
    }

    const doc = pick.contentDocument;
    doc.body.innerHTML = content;
    doc.body.dispatchEvent(new Event("input", { bubbles: true }));
    doc.body.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, mode: "iframe" };
  }, html);

  if (!result.ok) {
    throw new Error("未找到公众号图文编辑器，请确认页面已进入“新建图文”编辑状态。");
  }
}

async function clickActionButton(page: Page, labels: string[]): Promise<string> {
  for (const label of labels) {
    const button = page.locator("button").filter({ hasText: label }).first();
    if (!(await button.isVisible().catch(() => false))) continue;
    await button.click();
    return label;
  }
  throw new Error(`未找到可点击按钮：${labels.join(", ")}`);
}

function appendToken(url: string, token: string | null): string {
  if (!token) return url;
  const u = new URL(url);
  u.searchParams.set("token", token);
  return u.toString();
}

async function openEditor(page: Page): Promise<Page> {
  const articleEntry = page.locator(".new-creation__menu-item").filter({ hasText: "文章" }).first();
  if (!(await articleEntry.isVisible().catch(() => false))) {
    throw new Error("公众号后台首页未找到“文章”创作入口。");
  }

  const [editorPage] = await Promise.all([
    page.waitForEvent("popup", { timeout: 15_000 }),
    articleEntry.click({ force: true }),
  ]);

  await editorPage.waitForLoadState("domcontentloaded", { timeout: 120_000 });
  await editorPage.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await sleep(2500);
  if (
    includesLoginHint(editorPage.url()) ||
    (await isLoginPromptVisible(editorPage)) ||
    (await isSessionExpired(editorPage))
  ) {
    throw new Error("当前登录态失效，无法进入公众号图文编辑页。");
  }

  const titleInput = await firstVisibleLocator(editorPage, [
    'textarea[placeholder*="输入标题"]',
    'textarea[placeholder*="标题"]',
    'input[placeholder*="标题"]',
    'textarea[name="title"]',
    "#title",
  ]);
  if (!titleInput) {
    if (await isSessionExpired(editorPage)) {
      throw new Error("当前登录态失效，无法进入公众号图文编辑页。");
    }
    throw new Error(`未识别到标题输入框，当前页面: ${editorPage.url()}`);
  }

  return editorPage;
}

export async function cookieAuth(storagePath: string): Promise<boolean> {
  if (!fs.existsSync(storagePath)) return false;
  const checkModes: boolean[] = [true, false];
  for (const headless of checkModes) {
    const browser = await launchWechatBrowser(headless);
    try {
      const ctx = await browser.newContext({ storageState: storagePath });
      const page = await ctx.newPage();
      const authedUrl = await gotoAuthedBackendRoot(page, 10_000);
      if (!authedUrl) continue;
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await sleep(1000);
      if (await isLoginPromptVisible(page)) continue;
      if (await isSessionExpired(page)) continue;
      if (hasAuthenticatedBackendUrl(authedUrl)) return true;
    } finally {
      await browser.close();
    }
  }
  return false;
}

export async function loginAndSaveCookie(storagePath: string): Promise<void> {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const browser = await launchWechatBrowser(false);
  const ctx = await browser.newContext({ locale: "zh-CN", viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  const blockedByClientUrls: string[] = [];
  page.on("requestfailed", (req) => {
    const errorText = req.failure()?.errorText ?? "";
    if (errorText.includes("ERR_BLOCKED_BY_CLIENT")) {
      blockedByClientUrls.push(req.url());
    }
  });
  await gotoLoginPage(page, LOGIN_URL);
  await waitForWechatQrCode(page, blockedByClientUrls);
  let authedUrl: string | null = null;
  if (process.env.SOCIAL_PUBLISH_LOGIN_STDIN === "1") {
    await waitForUserLoginComplete(page);
    authedUrl = await stabilizeAuthenticatedPage(page, 20_000);
  } else {
    authedUrl = await waitUntilWechatMpLoggedIn(page);
  }
  if (!authedUrl) {
    authedUrl = await stabilizeAuthenticatedPage(page, 10_000);
  }
  if (!authedUrl) {
    authedUrl = await gotoAuthedBackendRoot(page, 20_000);
  }
  if (!authedUrl) {
    const finalUrl = page.url();
    const token = extractWechatToken(finalUrl);
    throw new Error(
      `[wechatmp] 登录后会话未建立成功，请重新扫码并完成账号确认。current_url=${finalUrl} token=${token ?? "none"}`
    );
  }
  console.log(`[wechatmp] authenticated_url=${authedUrl}`);
  if (await isLoginPromptVisible(page) || (await isSessionExpired(page))) {
    throw new Error(
      `[wechatmp] 登录后页面仍显示登录提示。current_url=${page.url()} token=${extractWechatToken(page.url()) ?? "none"}`
    );
  }
  await ctx.storageState({ path: storagePath });
  await browser.close();
}

export type WechatmpPublishOptions = {
  account: string;
  source: string;
  sourceType?: ArticleSourceHint;
  title: string;
  author?: string;
  digest?: string;
  publish?: boolean;
};

export async function publishWechatArticle(
  opts: WechatmpPublishOptions
): Promise<PublishResult> {
  const storagePath = resolveWechatmpCookiePath(opts.account);
  const total = 8;

  emit(1, total, "INIT", "检查参数");
  emit(1, total, "INIT", "OK", true);

  emit(2, total, "COOKIE_CHECK", "校验公众号登录态");
  let valid = await cookieAuth(storagePath);
  if (!valid) {
    emit(2, total, "COOKIE_CHECK", "失效", false);
    emit(3, total, "COOKIE_REFRESH", "请扫码登录公众号后台");
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
  emit(4, total, "CONTENT_PREPARE", `来源: ${article.sourceType}`, true);

  const browser = await launchWechatBrowser(isHeadless());
  const ctx = await browser.newContext({ storageState: storagePath, locale: "zh-CN" });
  const page = await ctx.newPage();

  try {
    emit(5, total, "OPEN_PUBLISH_PAGE", "打开公众号图文编辑页");
    const authedUrl = await gotoAuthedBackendRoot(page, 20_000);
    if (!authedUrl) {
      throw new Error("当前登录态失效，无法进入公众号后台首页。");
    }
    const editorPage = await openEditor(page);

    emit(6, total, "FILL_FORM", "填写图文内容");
    await fillIfPresent(
      editorPage,
      ['textarea[placeholder*="输入标题"]', 'textarea[placeholder*="标题"]', 'textarea[name="title"]', "#title"],
      opts.title
    );
    await fillIfPresent(
      editorPage,
      ['input[placeholder*="请输入作者"]', 'input[placeholder*="作者"]', 'input[name="author"]', "#author"],
      opts.author
    );
    await fillIfPresent(
      editorPage,
      ['textarea[placeholder*="摘要"]', 'textarea[name="digest"]', "#js_description"],
      opts.digest
    );
    await setEditorHtml(editorPage, article.html);

    emit(7, total, "PUBLISHING", opts.publish ? "发布文章" : "保存草稿");
    const usedButton = await clickActionButton(
      editorPage,
      opts.publish ? PUBLISH_BUTTON_TEXTS : DRAFT_BUTTON_TEXTS
    );
    console.log(`[wechatmp] 已点击按钮: ${usedButton}`);
    await sleep(3000);

    await ctx.storageState({ path: storagePath });
    emit(8, total, "DONE", "成功", true);
    return {
      platform: "wechatmp",
      reviewUrl: editorPage.url(),
    };
  } finally {
    await ctx.close();
    await browser.close();
  }
}
