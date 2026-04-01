/**
 * 抖音创作者平台视频发布（Playwright）。
 * 登录逻辑与 Python douyin_cookie_gen / _extract_douyin_qrcode_src 完全对齐。
 */
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Page } from "playwright";
import { selectAllModifier } from "../config.js";
import {
  launchBrowser,
  applyStealthScript,
  gotoLoginPage,
  waitForUserLoginComplete,
} from "../browser.js";
import { emit } from "../progress.js";
import { resolveDouyinCookiePath } from "../paths.js";

const UPLOAD_URL =
  "https://creator.douyin.com/creator-micro/content/upload";
const PUBLISH_V1 =
  "https://creator.douyin.com/creator-micro/content/publish?enter_from=publish_page";
const PUBLISH_V2 =
  "https://creator.douyin.com/creator-micro/content/post/video?enter_from=publish_page";
const MANAGE_PATTERN =
  "https://creator.douyin.com/creator-micro/content/manage**";

// ─── cookie 校验（与 Python cookie_auth 完全一致）──────────────

export async function cookieAuth(storagePath: string): Promise<boolean> {
  if (!fs.existsSync(storagePath)) return false;
  const browser = await launchBrowser(true);
  try {
    const ctx = await browser.newContext({ storageState: storagePath });
    await applyStealthScript(ctx);
    const page = await ctx.newPage();
    await page.goto(UPLOAD_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    try {
      await page.waitForURL(UPLOAD_URL, { timeout: 5000 });
    } catch {
      return false;
    }
    await sleep(5000);
    if (
      (await page.getByText("手机号登录").count()) > 0 ||
      (await page.getByText("扫码登录").count()) > 0
    )
      return false;
    return true;
  } finally {
    await browser.close();
  }
}

// ─── 登录（与 Python douyin_cookie_gen + _extract_douyin_qrcode_src 对齐）──

/**
 * Python 原版流程：
 * 1. goto creator.douyin.com
 * 2. 等 "扫码登录" tab 出现 → 它的父级的下一个兄弟 div 里找 img[aria-label="二维码"]
 * 3. 如果没找到就 fallback 到 page.get_by_role("img", name="二维码")
 * 4. 等二维码可见
 */
async function waitForDouyinQrCode(page: Page): Promise<void> {
  const scanTab = page.getByText("扫码登录", { exact: true }).first();
  await scanTab.waitFor({ state: "visible", timeout: 30_000 });

  let qr = scanTab
    .locator("..")
    .locator("xpath=following-sibling::div[1]")
    .locator('img[aria-label="二维码"]')
    .first();

  if ((await qr.count()) === 0) {
    qr = page.getByRole("img", { name: "二维码" }).first();
  }

  await qr.waitFor({ state: "visible", timeout: 30_000 });
  console.log("[douyin] 二维码已显示，请用抖音 APP 扫码");
}

/**
 * 轮询检测扫码是否完成（与 cookieAuth 思路一致：已在创作者域且登录 Tab 不再展示）。
 * 默认替代「仅 Inspector Resume」：扫码成功后无需再手动点 Continue。
 */
async function waitUntilDouyinLoggedIn(page: Page): Promise<void> {
  const timeoutMs = 180_000;
  const pollMs = 400;
  const needStable = 3;
  const start = Date.now();
  let stable = 0;
  console.log("[douyin] 正在轮询登录状态，扫码成功后将自动继续…");

  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    const onCreator = url.includes("creator.douyin.com");
    const scanVis = await page
      .getByText("扫码登录", { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    const phoneVis = await page
      .getByText("手机号登录", { exact: true })
      .first()
      .isVisible()
      .catch(() => false);

    if (onCreator && !scanVis && !phoneVis) {
      stable += 1;
      if (stable >= needStable) {
        await sleep(800);
        console.log("[douyin] 已检测到登录成功");
        return;
      }
    } else {
      stable = 0;
    }
    await sleep(pollMs);
  }

  console.warn(
    "[douyin] 自动检测超时（3 分钟），请改用 Playwright Inspector 点 Resume，或设置 SOCIAL_PUBLISH_LOGIN_STDIN=1 在终端按 Enter"
  );
  await waitForUserLoginComplete(page);
}

export async function loginAndSaveCookie(storagePath: string): Promise<void> {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const browser = await launchBrowser(false);
  const ctx = await browser.newContext();
  await applyStealthScript(ctx);
  const page = await ctx.newPage();
  await gotoLoginPage(page, "https://creator.douyin.com/");
  await waitForDouyinQrCode(page);
  if (process.env.SOCIAL_PUBLISH_LOGIN_STDIN === "1") {
    await waitForUserLoginComplete(page);
  } else if (process.env.SOCIAL_PUBLISH_LOGIN_NO_POLL === "1") {
    await waitForUserLoginComplete(page);
  } else {
    await waitUntilDouyinLoggedIn(page);
  }
  await sleep(2000);
  await ctx.storageState({ path: storagePath });
  await browser.close();
}

// ─── 发布选项 ──────────────────────────────────────────────────

export type DouyinPublishOptions = {
  account: string;
  videoFile: string;
  title: string;
  description?: string;
  tags: string[];
  schedule?: Date | null;
};

// ─── 内部交互函数 ──────────────────────────────────────────────

async function fillTitleAndDescription(
  page: Page,
  title: string,
  description: string,
  tags: string[]
): Promise<void> {
  const section = page
    .getByText("作品描述", { exact: true })
    .locator("xpath=ancestor::div[2]")
    .locator("xpath=following-sibling::div[1]");

  const titleInput = section.locator('input[type="text"]').first();
  await titleInput.waitFor({ state: "visible", timeout: 10_000 });
  await titleInput.fill(title.slice(0, 30));

  const editor = section
    .locator('.zone-container[contenteditable="true"]')
    .first();
  await editor.waitFor({ state: "visible", timeout: 10_000 });
  await editor.click();
  const mod = selectAllModifier();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press("Delete");
  await page.keyboard.type(description);

  for (const tag of tags) {
    await page.keyboard.type(` #${tag}`);
    await page.keyboard.press("Space");
  }
}

/** 检测页面是否显示登录弹层 */
async function isLoginOverlayVisible(page: Page): Promise<boolean> {
  const phoneVis = await page
    .getByRole("textbox", { name: "请输入手机号" })
    .isVisible()
    .catch(() => false);
  if (phoneVis) return true;
  const scanVis = await page
    .getByText("扫码登录", { exact: true })
    .first()
    .isVisible()
    .catch(() => false);
  return scanVis;
}

/**
 * 上传页出现登录弹层时：就地切到「扫码登录」→ 等用户扫码 → 轮询成功 → 刷新页面。
 * 这样不用退出进程、不用重开浏览器，体验与 social-auto-upload 一致。
 */
async function handleInPageLogin(
  page: Page,
  storagePath: string
): Promise<void> {
  console.log("[douyin] 上传页需要登录，正在切到扫码…");

  const scanTab = page.getByText("扫码登录", { exact: true }).first();
  if (await scanTab.isVisible().catch(() => false)) {
    await scanTab.click().catch(() => {});
    await sleep(1000);
  }

  try {
    await waitForDouyinQrCode(page);
  } catch {
    console.log("[douyin] 未找到二维码，尝试刷新页面重新加载…");
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(3000);
    await waitForDouyinQrCode(page);
  }

  await waitUntilDouyinLoggedIn(page);

  const ctx = page.context();
  await ctx.storageState({ path: storagePath });
  console.log("[douyin] Cookie 已更新");

  await page.goto(UPLOAD_URL, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await sleep(3000);
}

/** 等待 file 控件就绪；如果出现登录弹层则就地扫码后继续。 */
async function waitForUploadFileInput(
  page: Page,
  storagePath: string
): Promise<void> {
  const deadline = Date.now() + 300_000;
  let loginHandled = false;

  while (Date.now() < deadline) {
    const fileCount = await page.locator('input[type="file"]').count();
    if (fileCount > 0) {
      await page
        .locator('input[type="file"]')
        .first()
        .waitFor({ state: "attached", timeout: 5000 });
      return;
    }

    if (await isLoginOverlayVisible(page)) {
      if (loginHandled) {
        throw new Error(
          "扫码后仍显示登录弹层，Cookie 可能无法持久化。请检查浏览器或网络环境。"
        );
      }
      await handleInPageLogin(page, storagePath);
      loginHandled = true;
      continue;
    }

    await sleep(500);
  }
  throw new Error("等待视频上传控件超时（5 分钟）：未找到 input[type=file]");
}

async function waitForPublishPage(page: Page): Promise<void> {
  for (;;) {
    try {
      await page.waitForURL(PUBLISH_V1, { timeout: 3000 });
      return;
    } catch {
      try {
        await page.waitForURL(PUBLISH_V2, { timeout: 3000 });
        return;
      } catch {
        await sleep(500);
      }
    }
  }
}

async function waitForUploadComplete(
  page: Page,
  videoFile: string
): Promise<void> {
  for (;;) {
    try {
      const n = await page
        .locator('[class^="long-card"] div:has-text("重新上传")')
        .count();
      if (n > 0) return;
      await sleep(2000);
      if (
        (await page
          .locator('div.progress-div > div:has-text("上传失败")')
          .count()) > 0
      ) {
        await page
          .locator('div.progress-div [class^="upload-btn-input"]')
          .setInputFiles(videoFile);
      }
    } catch {
      await sleep(2000);
    }
  }
}

async function handleAutoCover(page: Page): Promise<void> {
  const hint = page.getByText("请设置封面后再发布").first();
  try {
    if (!(await hint.isVisible())) return;
  } catch {
    return;
  }
  const rec = page.locator('[class^="recommendCover-"]').first();
  if ((await rec.count()) === 0) return;
  try {
    await rec.click();
    await sleep(1000);
    const confirm = page.getByText("是否确认应用此封面？").first();
    if (await confirm.isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "确定" }).click();
      await sleep(1000);
    }
  } catch {
    /* best effort */
  }
}

async function setScheduleDouyin(page: Page, dt: Date): Promise<void> {
  const mod = selectAllModifier();
  await page.locator("[class^='radio']:has-text('定时发布')").click();
  await sleep(1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const formatted = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  await sleep(1000);
  await page.locator('.semi-input[placeholder="日期和时间"]').click();
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.type(formatted);
  await page.keyboard.press("Enter");
  await sleep(1000);
}

async function clickPublishDouyin(page: Page): Promise<void> {
  for (;;) {
    try {
      const btn = page.getByRole("button", { name: "发布", exact: true });
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForURL(MANAGE_PATTERN, { timeout: 3000 });
        return;
      }
    } catch {
      await handleAutoCover(page);
      await sleep(500);
    }
  }
}

// ─── 主发布函数 ────────────────────────────────────────────────

export async function publishDouyinVideo(
  opts: DouyinPublishOptions
): Promise<void> {
  const storagePath = resolveDouyinCookiePath(opts.account);
  const videoPath = path.resolve(opts.videoFile);
  if (!fs.existsSync(videoPath))
    throw new Error(`Video not found: ${videoPath}`);

  const total = 8;
  emit(1, total, "INIT", "检查参数");
  emit(1, total, "INIT", "OK", true);

  emit(2, total, "COOKIE_CHECK", "校验抖音登录态");
  const hasCookie = fs.existsSync(storagePath);
  if (!hasCookie) {
    emit(2, total, "COOKIE_CHECK", "无 Cookie 文件", false);
    emit(3, total, "COOKIE_REFRESH", "首次登录：即将弹出浏览器扫码");
    await loginAndSaveCookie(storagePath);
    emit(3, total, "COOKIE_REFRESH", "OK", true);
  } else {
    emit(2, total, "COOKIE_CHECK", "Cookie 文件存在（打开上传页后验证）", true);
  }

  const browser = await launchBrowser(false);
  const ctx = await browser.newContext({
    storageState: storagePath,
    permissions: ["geolocation"],
  });
  await applyStealthScript(ctx);
  const page = await ctx.newPage();

  try {
    emit(4, total, "OPEN_PUBLISH_PAGE", UPLOAD_URL);
    await page.goto(UPLOAD_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await sleep(3000);

    emit(5, total, "UPLOAD_START", path.basename(videoPath));
    await waitForUploadFileInput(page, storagePath);
    await page.locator('input[type="file"]').first().setInputFiles(videoPath);
    await waitForPublishPage(page);
    await sleep(1000);

    const desc = opts.description ?? opts.title;
    await fillTitleAndDescription(page, opts.title, desc, opts.tags);

    emit(6, total, "UPLOAD_TRANSFERRING", "等待视频上传完成");
    await waitForUploadComplete(page, videoPath);

    if (opts.schedule) {
      await setScheduleDouyin(page, opts.schedule);
    }

    emit(7, total, "PUBLISHING", "发布");
    await clickPublishDouyin(page);

    await ctx.storageState({ path: storagePath });
    emit(8, total, "DONE", "成功", true);
  } finally {
    await ctx.close();
    await browser.close();
  }
}
