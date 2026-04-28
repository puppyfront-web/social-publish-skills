/**
 * 微信视频号发布（Playwright）。
 * 登录逻辑与 Python get_tencent_cookie / cookie_auth 完全对齐。
 */
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Page } from "playwright";
import {
  isHeadless,
  selectAllModifier,
} from "../config.js";
import {
  launchBrowser,
  applyStealthScript,
  gotoLoginPage,
  waitForUserLoginComplete,
} from "../browser.js";
import { emit } from "../progress.js";
import { resolveTencentCookiePath } from "../paths.js";
import { type PublishResult } from "../publish-result.js";

const CREATE_URL = "https://channels.weixin.qq.com/platform/post/create";
const TENCENT_UPLOAD_TRIGGER_TEXTS = [
  "上传视频",
  "选择视频",
  "从相册选择",
  "点击上传",
];
const TENCENT_BLOCKING_TEXTS = [
  "扫码登录",
  "安全验证",
  "环境异常",
  "访问受限",
  "重新登录",
];

function formatDurationZh(ms: number): string {
  if (ms % 60_000 === 0) return `${ms / 60_000} 分钟`;
  const sec = Math.floor(ms / 1000);
  return `${sec} 秒`;
}

/**
 * 视频号发表页是 SPA：domcontentloaded 后仍可能因鉴权被重定向到 login。
 * 轮询直到路径稳定为 /post/create 且无「扫码登录」遮罩，或明确进入 /login。
 */
async function waitUntilTencentCreateOrLoginResolved(
  page: Page,
  timeoutMs: number
): Promise<"create" | "login" | "other"> {
  const start = Date.now();
  let stableOk = 0;
  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    if (url.includes("/login")) return "login";
    if (url.includes("/post/create")) {
      const scanLoginVisible = await page
        .getByText("扫码登录", { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
      if (!scanLoginVisible) {
        stableOk += 1;
        if (stableOk >= 4) return "create";
      } else {
        stableOk = 0;
      }
    } else {
      stableOk = 0;
    }
    await sleep(500);
  }
  const url = page.url();
  if (url.includes("/login")) return "login";
  if (url.includes("/post/create")) return "create";
  return "other";
}

/** 发表页可能被重定向到 /platform 首页，需再次进入 create */
async function ensureTencentPostCreatePage(page: Page): Promise<void> {
  const onCreate = () => page.url().includes("/post/create");
  for (let i = 0; i < 3; i++) {
    if (onCreate()) {
      const scan = await page
        .getByText("扫码登录", { exact: true })
        .first()
        .isVisible()
        .catch(() => false);
      if (!scan) return;
    }
    await page.goto(CREATE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    const outcome = await waitUntilTencentCreateOrLoginResolved(page, 90_000);
    if (outcome === "login") {
      throw new Error(
        `无法进入视频发表页（会话失效或需重新登录），当前: ${page.url()}`
      );
    }
    await sleep(1500);
  }
  if (!onCreate()) {
    throw new Error(
      `无法进入视频发表页（期望路径含 /post/create），当前: ${page.url()}`
    );
  }
}

async function collectTencentUploadDiagnostics(page: Page): Promise<string> {
  const visibleTriggers: string[] = [];
  for (const text of TENCENT_UPLOAD_TRIGGER_TEXTS) {
    const visible = await page
      .getByText(text, { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) visibleTriggers.push(text);
  }

  const blockingTexts: string[] = [];
  for (const text of TENCENT_BLOCKING_TEXTS) {
    const visible = await page
      .getByText(text, { exact: false })
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) blockingTexts.push(text);
  }

  const frameUrls = page
    .frames()
    .map((frame) => frame.url())
    .filter((url) => Boolean(url) && url !== "about:blank")
    .slice(0, 5);

  let frameFileInputs = 0;
  for (const frame of page.frames()) {
    frameFileInputs += await frame
      .locator('input[type="file"]')
      .count()
      .catch(() => 0);
  }

  const title = await page.title().catch(() => "");
  const pageFileInputs = await page
    .locator('input[type="file"]')
    .count()
    .catch(() => 0);

  return [
    `url=${page.url()}`,
    title ? `title=${JSON.stringify(title)}` : "",
    `page_file_inputs=${pageFileInputs}`,
    `frame_file_inputs=${frameFileInputs}`,
    blockingTexts.length > 0
      ? `blocking=${blockingTexts.join("|")}`
      : "blocking=none",
    visibleTriggers.length > 0
      ? `triggers=${visibleTriggers.join("|")}`
      : "triggers=none",
    frameUrls.length > 0 ? `frames=${frameUrls.join(",")}` : "frames=none",
  ]
    .filter(Boolean)
    .join(" ; ");
}

async function trySetTencentVideoFile(
  page: Page,
  videoPath: string
): Promise<boolean> {
  const pageFileInput = page.locator('input[type="file"]').first();
  if ((await pageFileInput.count()) > 0) {
    await pageFileInput.setInputFiles(videoPath, {
      timeout: TENCENT_FILE_TIMEOUT,
    });
    return true;
  }

  const videoInputs = page.locator(
    'input[type="file"][accept*="video"], input[accept*="mp4"]'
  );
  if ((await videoInputs.count()) > 0) {
    await videoInputs.first().setInputFiles(videoPath, {
      timeout: TENCENT_FILE_TIMEOUT,
    });
    return true;
  }

  for (const frame of page.frames()) {
    const frameInput = frame.locator('input[type="file"]').first();
    if ((await frameInput.count()) > 0) {
      await frameInput.setInputFiles(videoPath, {
        timeout: TENCENT_FILE_TIMEOUT,
      });
      return true;
    }
  }

  for (const text of TENCENT_UPLOAD_TRIGGER_TEXTS) {
    const btn = page.getByText(text, { exact: false }).first();
    if ((await btn.count()) === 0) continue;
    try {
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 3_000 }),
        btn.click({ timeout: 2_000 }),
      ]);
      await chooser.setFiles(videoPath);
      return true;
    } catch {
      /* try next candidate */
    }
  }

  return false;
}

const SHORT_TITLE_SPECIAL = new Set([
  ..."《》",
  "\u201c",
  "\u201d",
  ":",
  "+",
  "?",
  "%",
  "°",
]);

function isShortTitleChar(ch: string): boolean {
  if (SHORT_TITLE_SPECIAL.has(ch)) return true;
  if (/^[a-zA-Z0-9]$/.test(ch)) return true;
  const code = ch.codePointAt(0) ?? 0;
  return code >= 0x4e00 && code <= 0x9fff;
}

export function formatShortTitle(origin: string): string {
  const filtered = [...origin]
    .map((ch) => {
      if (isShortTitleChar(ch)) return ch;
      if (ch === ",") return " ";
      return "";
    })
    .join("");
  let s = filtered;
  if (s.length > 16) s = s.slice(0, 16);
  else if (s.length < 6) s = s + " ".repeat(6 - s.length);
  return s;
}

// ─── cookie 校验（与 Python cookie_auth 语义对齐；增加 SPA 鉴权等待）──────────────

export async function cookieAuth(storagePath: string): Promise<boolean> {
  if (!fs.existsSync(storagePath)) return false;
  // 无头校验易被视频号风控/中间态误判；可用 SOCIAL_PUBLISH_HEADLESS=0 有头校验。
  const browser = await launchBrowser(isHeadless());
  try {
    const ctx = await browser.newContext({ storageState: storagePath });
    await applyStealthScript(ctx);
    const page = await ctx.newPage();
    await page.goto(CREATE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const outcome = await waitUntilTencentCreateOrLoginResolved(page, 60_000);
    if (outcome === "login") return false;
    if (outcome !== "create") return false;
    const url = page.url();
    if (!url.includes("channels.weixin.qq.com/platform")) return false;
    return true;
  } finally {
    await browser.close();
  }
}

// ─── 登录（与 Python get_tencent_cookie 完全一致）──────────────
// Python 原版：打开 channels.weixin.qq.com → page.pause() → 保存 storageState
// 二维码由页面自然显示（iframe 中的微信扫码），不需要额外选择器操作

async function waitUntilTencentLoggedIn(page: Page): Promise<void> {
  const rawTimeout = process.env.SOCIAL_PUBLISH_TENCENT_LOGIN_TIMEOUT_MS;
  const parsedTimeout = rawTimeout ? Number(rawTimeout) : NaN;
  const timeoutMs =
    Number.isFinite(parsedTimeout) && parsedTimeout >= 30_000
      ? Math.floor(parsedTimeout)
      : 300_000;
  const timeoutLabel = formatDurationZh(timeoutMs);
  const pollMs = 500;
  const needStable = 3;
  const start = Date.now();
  let stable = 0;
  console.log(
    `[tencent] 请在 ${timeoutLabel} 内完成扫码登录，超时将回退到手动确认（Inspector Resume / 终端回车）`
  );
  console.log("[tencent] 正在轮询登录状态，扫码成功后将自动继续…");

  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    const onChannels = url.includes("channels.weixin.qq.com/platform");
    const onLogin = url.includes("/login");
    const scanLoginVisible = await page
      .getByText("扫码登录", { exact: true })
      .first()
      .isVisible()
      .catch(() => false);

    if (onChannels && !onLogin && !scanLoginVisible) {
      stable += 1;
      if (stable >= needStable) {
        await sleep(800);
        console.log("[tencent] 已检测到登录成功");
        return;
      }
    } else {
      stable = 0;
    }
    await sleep(pollMs);
  }

  console.warn(
    `[tencent] 自动检测超时（${timeoutLabel}），回退到手动模式`
  );
  await waitForUserLoginComplete(page);
}

export async function loginAndSaveCookie(storagePath: string): Promise<void> {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const browser = await launchBrowser(false);
  const ctx = await browser.newContext();
  await applyStealthScript(ctx);
  const page = await ctx.newPage();
  await gotoLoginPage(page, "https://channels.weixin.qq.com");
  console.log("请在浏览器中用微信扫码登录。");
  if (process.env.SOCIAL_PUBLISH_LOGIN_STDIN === "1") {
    await waitForUserLoginComplete(page);
  } else {
    await waitUntilTencentLoggedIn(page);
  }
  await sleep(2000);
  await ctx.storageState({ path: storagePath });
  await browser.close();
}

// ─── 以下为发布相关 ───────────────────────────────────────────

export type TencentPublishOptions = {
  account: string;
  videoFile: string;
  title: string;
  tags: string[];
  schedule?: Date | null;
  category?: string;
  draft?: boolean;
};

const TENCENT_FILE_TIMEOUT = 180_000;

/** 发表页为 SPA，file input 可能晚于 domcontentloaded 才挂载，或在 iframe 内 */
async function setTencentVideoFile(page: Page, videoPath: string): Promise<void> {
  await ensureTencentPostCreatePage(page);
  await page.waitForLoadState("load", { timeout: 90_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 45_000 }).catch(() => {});
  await sleep(2000);
  const deadline = Date.now() + TENCENT_FILE_TIMEOUT;
  let lastLogAt = 0;

  while (Date.now() < deadline) {
    if (!page.url().includes("/post/create")) {
      await ensureTencentPostCreatePage(page);
      await sleep(1500);
    }

    if (await trySetTencentVideoFile(page, videoPath)) {
      return;
    }

    if (Date.now() - lastLogAt >= 10_000) {
      console.log(
        `[tencent] 等待上传控件中: ${await collectTencentUploadDiagnostics(page)}`
      );
      lastLogAt = Date.now();
    }

    await sleep(1000);
  }

  const diagnostics = await collectTencentUploadDiagnostics(page);
  throw new Error(
    `视频号发表页未找到上传控件。${diagnostics}。可尝试：SOCIAL_PUBLISH_HEADLESS=0 有界面重试；确认已进入发表页且未被安全验证拦截。`
  );
}

async function handleUploadError(page: Page, videoPath: string): Promise<void> {
  await page.locator('div.media-status-content div.tag-inner:has-text("删除")').click();
  await page.getByRole("button", { name: "删除", exact: true }).click();
  await setTencentVideoFile(page, videoPath);
}

async function addTitleTags(page: Page, title: string, tags: string[]): Promise<void> {
  await page.locator("div.input-editor").click();
  await page.keyboard.type(title);
  await page.keyboard.press("Enter");
  for (const tag of tags) {
    await page.keyboard.type(`#${tag}`);
    await page.keyboard.press("Space");
  }
}

async function addCollection(page: Page): Promise<void> {
  const wrap = page.getByText("添加到合集").locator("xpath=following-sibling::div");
  const items = wrap.locator(".option-list-wrap > div");
  if ((await items.count()) > 1) {
    await wrap.click();
    await items.first().click();
  }
}

async function addOriginal(page: Page, category?: string): Promise<void> {
  const orig = page.getByLabel("视频为原创");
  if ((await orig.count()) > 0) await orig.check();

  const terms = page.locator('label:has-text("我已阅读并同意 《视频号原创声明使用条款》")');
  if (await terms.isVisible().catch(() => false)) {
    await page
      .getByLabel("我已阅读并同意 《视频号原创声明使用条款》")
      .check();
    await page.getByRole("button", { name: "声明原创" }).click();
  }

  if ((await page.locator('div.label span:has-text("声明原创")').count()) > 0 && category) {
    const cb = page.locator("div.declare-original-checkbox input.ant-checkbox-input");
    if ((await cb.count()) > 0 && !(await cb.isDisabled())) await cb.click();

    const checked = page.locator(
      "div.declare-original-dialog label.ant-checkbox-wrapper.ant-checkbox-wrapper-checked:visible"
    );
    if ((await checked.count()) === 0) {
      await page.locator("div.declare-original-dialog input.ant-checkbox-input:visible").click();
    }

    if (
      await page
        .locator('div.original-type-form > div.form-label:has-text("原创类型"):visible')
        .count()
        .then((n) => n > 0)
    ) {
      await page.locator("div.form-content:visible").click();
      await page
        .locator(
          `div.form-content:visible ul.weui-desktop-dropdown__list li.weui-desktop-dropdown__list-ele:has-text("${category}")`
        )
        .first()
        .click();
      await sleep(1000);
    }
    const btn = page.locator('button:has-text("声明原创"):visible');
    if ((await btn.count()) > 0) await btn.click();
  }
}

async function detectUploadStatus(page: Page, videoPath: string): Promise<void> {
  for (;;) {
    try {
      const pub = page.getByRole("button", { name: "发表" });
      const cls = (await pub.getAttribute("class")) ?? "";
      if (!cls.includes("weui-desktop-btn_disabled")) break;
      await sleep(2000);
      const err = await page.locator("div.status-msg.error").count();
      const del = await page
        .locator('div.media-status-content div.tag-inner:has-text("删除")')
        .count();
      if (err > 0 && del > 0) await handleUploadError(page, videoPath);
    } catch {
      await sleep(2000);
    }
  }
}

async function setScheduleTime(page: Page, publishDate: Date): Promise<void> {
  const mod = selectAllModifier();
  await page.locator("label").filter({ hasText: "定时" }).nth(1).click();
  await page.click('input[placeholder="请选择发表时间"]');

  const m = publishDate.getMonth() + 1;
  const currentMonth = `${m < 10 ? "0" : ""}${m}月`;
  const pageMonth = await page
    .locator('span.weui-desktop-picker__panel__label:has-text("月")')
    .innerText();
  if (pageMonth.trim() !== currentMonth) {
    await page.click("button.weui-desktop-btn__icon__right");
  }

  const links = await page.locator("table.weui-desktop-picker__table a").all();
  const dayStr = String(publishDate.getDate());
  for (const el of links) {
    const c = (await el.getAttribute("class")) ?? "";
    if (c.includes("weui-desktop-picker__disabled")) continue;
    const text = (await el.innerText()).trim();
    if (text === dayStr) {
      await el.click();
      break;
    }
  }

  await page.click('input[placeholder="请选择时间"]');
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.type(String(publishDate.getHours()));
  await page.locator("div.input-editor").click();
}

async function addShortTitle(page: Page, title: string): Promise<void> {
  const short = page
    .getByText("短标题", { exact: true })
    .locator("..")
    .locator("xpath=following-sibling::div")
    .locator('span input[type="text"]');
  if ((await short.count()) > 0) await short.fill(formatShortTitle(title));
}

async function clickPublish(page: Page, draft: boolean): Promise<void> {
  for (;;) {
    try {
      if (draft) {
        const b = page.locator('div.form-btns button:has-text("保存草稿")');
        if ((await b.count()) > 0) await b.click();
        await page.waitForURL("**/post/list**", { timeout: 5000 });
      } else {
        const b = page.locator('div.form-btns button:has-text("发表")');
        if ((await b.count()) > 0) await b.click();
        await page.waitForURL("https://channels.weixin.qq.com/platform/post/list", {
          timeout: 5000,
        });
      }
      return;
    } catch {
      const url = page.url();
      if (draft && (url.includes("post/list") || url.includes("draft"))) return;
      if (!draft && url.includes("https://channels.weixin.qq.com/platform/post/list")) return;
      await sleep(500);
    }
  }
}

export async function publishTencentVideo(
  opts: TencentPublishOptions
): Promise<PublishResult> {
  const storagePath = resolveTencentCookiePath(opts.account);
  const videoPath = path.resolve(opts.videoFile);
  if (!fs.existsSync(videoPath)) throw new Error(`Video not found: ${videoPath}`);

  const total = 8;
  emit(1, total, "INIT", "检查参数");
  emit(1, total, "INIT", "OK", true);

  emit(2, total, "COOKIE_CHECK", "校验登录态");
  let valid = await cookieAuth(storagePath);
  if (!valid) {
    emit(2, total, "COOKIE_CHECK", "失效", false);
    emit(3, total, "COOKIE_REFRESH", "请登录（headed + pause）");
    await loginAndSaveCookie(storagePath);
    valid = await cookieAuth(storagePath);
    if (!valid) throw new Error("Cookie still invalid after login");
    emit(3, total, "COOKIE_REFRESH", "OK", true);
  } else emit(2, total, "COOKIE_CHECK", "有效", true);

  const headless = isHeadless();
  const browser = await launchBrowser(headless);
  const ctx = await browser.newContext({ storageState: storagePath });
  await applyStealthScript(ctx);
  const page = await ctx.newPage();

  try {
    emit(4, total, "OPEN_PUBLISH_PAGE", CREATE_URL);
    await page.goto(CREATE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await ensureTencentPostCreatePage(page);

    emit(5, total, "UPLOAD_START", path.basename(videoPath));
    await setTencentVideoFile(page, videoPath);
    await addTitleTags(page, opts.title, opts.tags);
    await addCollection(page);
    await addOriginal(page, opts.category);

    emit(6, total, "UPLOAD_TRANSFERRING", "等待转码");
    await detectUploadStatus(page, videoPath);

    if (opts.schedule) await setScheduleTime(page, opts.schedule);
    await addShortTitle(page, opts.title);

    emit(7, total, "PUBLISHING", opts.draft ? "草稿" : "发表");
    await clickPublish(page, !!opts.draft);

    await ctx.storageState({ path: storagePath });
    emit(8, total, "DONE", "成功", true);
    return {
      platform: "tencent",
      reviewUrl: page.url(),
    };
  } finally {
    await ctx.close();
    await browser.close();
  }
}
