/**
 * 快手创作者平台视频发布（Playwright）。
 * 登录逻辑与 Python get_ks_cookie / _extract_ks_qrcode_src 完全对齐。
 */
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { type Locator, type Page } from "playwright";
import { selectAllModifier } from "../config.js";
import {
  launchBrowser,
  applyStealthScript,
  gotoLoginPage,
  waitForUserLoginComplete,
} from "../browser.js";
import { emit } from "../progress.js";
import { resolveKuaishouCookiePath } from "../paths.js";
import { type PublishResult } from "../publish-result.js";

const UPLOAD_URL = "https://cp.kuaishou.com/article/publish/video";
const LOGIN_URL =
  "https://passport.kuaishou.com/pc/account/login/?sid=kuaishou.web.cp.api&callback=https%3A%2F%2Fcp.kuaishou.com%2Frest%2Finfra%2Fsts%3FfollowUrl%3Dhttps%253A%252F%252Fcp.kuaishou.com%252Farticle%252Fpublish%252Fvideo%26setRootDomain%3Dtrue";
const UPLOAD_URL_PATTERN = "**/article/publish/video**";
const MANAGE_URL_PATTERN =
  "**/article/manage/video?status=2&from=publish**";
const COOKIE_INVALID_SELECTOR =
  "div.names div.container div.name:text('机构服务')";

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
      await page.waitForSelector(COOKIE_INVALID_SELECTOR, { timeout: 5000 });
      return false;
    } catch {
      return true;
    }
  } finally {
    await browser.close();
  }
}

// ─── 登录（与 Python _extract_ks_qrcode_src + get_ks_cookie 对齐，并增强新版页面）──

function kuaishouQrLocator(scope: Locator) {
  return scope
    .locator(
      [
        'div.qr-login img[alt="qrcode"]',
        'div.qr-login img[alt="Qrcode"]',
        "div.qr-login img",
        'img[alt="qrcode"]',
        'img[alt*="二维码"]',
      ].join(", ")
    )
    .first();
}

async function tryClickPlatformSwitch(page: Page): Promise<void> {
  const sw = page.locator("div.platform-switch").first();
  if ((await sw.count()) === 0) return;
  try {
    await sw.waitFor({ state: "visible", timeout: 5000 });
    await sw.click();
    await sleep(1200);
  } catch {
    /* ignore */
  }
}

/**
 * Python 原版 + 兼容：SPA 需在 domcontentloaded 后继续等渲染；部分版本默认密码页需点「扫码登录」。
 */
async function waitForKuaishouQrCode(page: Page): Promise<void> {
  console.log("[kuaishou] 等待登录页渲染（SPA 可能较慢）…");
  await page.waitForLoadState("load", { timeout: 45_000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await sleep(1500);
  console.log(`[kuaishou] 当前地址: ${page.url()}`);

  const formCandidates = [
    "main#login-form",
    "#login-form",
    'main[class*="login"]',
    '[id*="login"][class*="form"]',
  ];
  let loginForm = page.locator(formCandidates[0]).first();
  for (const sel of formCandidates) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
      loginForm = loc;
      break;
    }
  }
  await loginForm.waitFor({ state: "visible", timeout: 45_000 });

  // 新版常见：默认「密码登录」，需切到扫码
  const scanTab = page.getByText("扫码登录", { exact: true }).first();
  if (await scanTab.isVisible({ timeout: 4000 }).catch(() => false)) {
    await scanTab.click();
    await sleep(800);
    console.log("[kuaishou] 已点击「扫码登录」");
  }

  const tryWaitQr = async (timeout: number): Promise<boolean> => {
    for (const loc of [kuaishouQrLocator(loginForm), kuaishouQrLocator(page.locator("body"))]) {
      try {
        await loc.waitFor({ state: "visible", timeout });
        return true;
      } catch {
        /* try next */
      }
    }
    try {
      const fl = page.frameLocator("iframe").first();
      const img = fl.locator("img").first();
      await img.waitFor({ state: "visible", timeout: Math.min(timeout, 8000) });
      return true;
    } catch {
      return false;
    }
  };

  if (await tryWaitQr(8000)) {
    console.log("[kuaishou] 二维码已显示，请用快手 APP 扫码");
    return;
  }

  await tryClickPlatformSwitch(page);
  if (await tryWaitQr(8000)) {
    console.log("[kuaishou] 二维码已显示（已切换扫码方式），请用快手 APP 扫码");
    return;
  }

  await tryClickPlatformSwitch(page);
  if (await tryWaitQr(12_000)) {
    console.log("[kuaishou] 二维码已显示，请用快手 APP 扫码");
    return;
  }

  throw new Error(
    `[kuaishou] 未找到可见的登录二维码（当前 URL: ${page.url()}）。请尝试：① 手动在页面点击「扫码登录」或 App 扫码入口；② 放大浏览器窗口；③ 将终端完整报错与页面截图发反馈。`
  );
}

async function waitUntilKuaishouLoggedIn(page: Page): Promise<void> {
  const timeoutMs = 180_000;
  const pollMs = 500;
  const needStable = 3;
  const start = Date.now();
  let stable = 0;
  console.log("[kuaishou] 正在轮询登录状态，扫码成功后将自动继续…");

  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    const onCp = url.includes("cp.kuaishou.com");
    const onPassport = url.includes("passport.kuaishou.com");

    if (onCp && !onPassport) {
      stable++;
      if (stable >= needStable) {
        await sleep(800);
        console.log("[kuaishou] 已检测到登录成功");
        return;
      }
    } else {
      stable = 0;
    }
    await sleep(pollMs);
  }

  console.warn(
    "[kuaishou] 自动检测超时（3 分钟），回退到手动模式"
  );
  await waitForUserLoginComplete(page);
}

export async function loginAndSaveCookie(storagePath: string): Promise<void> {
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  const browser = await launchBrowser(false);
  const ctx = await browser.newContext({
    locale: "zh-CN",
    viewport: { width: 1366, height: 900 },
  });
  await applyStealthScript(ctx);
  const page = await ctx.newPage();
  await gotoLoginPage(page, LOGIN_URL);
  await waitForKuaishouQrCode(page);
  if (process.env.SOCIAL_PUBLISH_LOGIN_STDIN === "1") {
    await waitForUserLoginComplete(page);
  } else {
    await waitUntilKuaishouLoggedIn(page);
  }
  await sleep(2000);
  await ctx.storageState({ path: storagePath });
  await browser.close();
}

// ─── 发布选项 ──────────────────────────────────────────────────

export type KuaishouPublishOptions = {
  account: string;
  videoFile: string;
  title: string;
  description?: string;
  tags: string[];
  schedule?: Date | null;
};

// ─── 内部交互函数 ──────────────────────────────────────────────

async function closeGuideOverlay(page: Page): Promise<void> {
  const joyride = page.locator(
    'div[id^="react-joyride-step"] div[role="alertdialog"]'
  );
  try {
    if ((await joyride.count()) === 0 || !(await joyride.first().isVisible()))
      return;
    const closeBtn = page
      .locator('div[role="alertdialog"]')
      .locator(
        '[aria-label="Skip"], [data-action="skip"], button[title="Skip"]'
      );
    await closeBtn.click({ force: true });
    await joyride.waitFor({ state: "hidden", timeout: 5000 });
  } catch {
    /* best effort */
  }
}

async function dismissKnowButton(page: Page): Promise<void> {
  const btn = page
    .locator('button[type="button"] span:text("我知道了")')
    .first();
  try {
    if ((await btn.count()) > 0 && (await btn.isVisible())) await btn.click();
  } catch {
    /* not shown */
  }
}

async function fillDescriptionAndTags(
  page: Page,
  description: string,
  tags: string[]
): Promise<void> {
  const mod = selectAllModifier();
  await page.getByText("描述").locator("xpath=following-sibling::div").click();
  await page.keyboard.press("Backspace");
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.press("Delete");
  await page.keyboard.type(description);
  await page.keyboard.press("Enter");

  for (const tag of tags.slice(0, 3)) {
    await page.keyboard.type(`#${tag} `);
    await sleep(2000);
  }
}

async function waitForUploadComplete(
  page: Page,
  videoFile: string
): Promise<void> {
  const maxRetries = 60;
  let count = 0;
  while (count < maxRetries) {
    try {
      if ((await page.locator("text=上传中").count()) === 0) return;
      if ((await page.locator("text=上传失败").count()) > 0) {
        await page
          .locator('div.progress-div [class^="upload-btn-input"]')
          .setInputFiles(videoFile);
      }
    } catch {
      /* retry */
    }
    await sleep(2000);
    count++;
  }
}

async function setScheduleKuaishou(page: Page, dt: Date): Promise<void> {
  const mod = selectAllModifier();
  const pad = (n: number) => String(n).padStart(2, "0");
  const formatted = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;

  await page
    .locator("label:text('发布时间')")
    .locator("xpath=following-sibling::div")
    .locator(".ant-radio-input")
    .nth(1)
    .click();
  await sleep(1000);
  await page
    .locator('div.ant-picker-input input[placeholder="选择日期时间"]')
    .click();
  await sleep(1000);
  await page.keyboard.press(`${mod}+A`);
  await page.keyboard.type(formatted);
  await page.keyboard.press("Enter");
  await sleep(1000);
}

async function clickPublishKuaishou(page: Page): Promise<void> {
  for (;;) {
    try {
      const publish = page.getByText("发布", { exact: true });
      if ((await publish.count()) > 0) {
        await publish.click();
        await sleep(1000);
        const confirm = page.getByText("确认发布");
        if ((await confirm.count()) > 0) await confirm.click();
        await page.waitForURL(MANAGE_URL_PATTERN, { timeout: 5000 });
        return;
      }
    } catch {
      await sleep(1000);
    }
  }
}

/** 检测快手上传页是否真正登录：未登录时页面只有「去上传」链接、无 input 控件。 */
async function detectKuaishouNeedLogin(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes("passport.kuaishou.com")) return true;
  if (!url.includes("cp.kuaishou.com")) return true;

  const goUpload = page.locator('a.upload:has-text("去上传")');
  if ((await goUpload.count()) > 0) return true;

  const inputs = await page.locator("input").count();
  if (inputs === 0) {
    const uploadBtns = await page.locator("button[class^='_upload-btn']").count();
    const fileInputs = await page.locator('input[type="file"]').count();
    if (uploadBtns === 0 && fileInputs === 0) return true;
  }
  return false;
}

/** 找到上传控件并选择视频文件：优先 input[type=file]，其次按钮触发 fileChooser。 */
async function waitForKuaishouUploadControl(
  page: Page,
  videoPath: string
): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const fi = await page.locator('input[type="file"]').count();
    if (fi > 0) {
      console.log("[kuaishou] 找到 input[type=file]，正在上传…");
      await page.locator('input[type="file"]').first().setInputFiles(videoPath);
      return;
    }

    const btn = page.locator("button[class^='_upload-btn']").first();
    if ((await btn.count()) > 0 && (await btn.isVisible().catch(() => false))) {
      console.log("[kuaishou] 找到 upload-btn，正在点击…");
      const [fc] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 10_000 }),
        btn.click(),
      ]);
      await fc.setFiles(videoPath);
      return;
    }

    const anyUpload = page.locator('[class*="upload-video"], [class*="upload-btn"]').first();
    if ((await anyUpload.count()) > 0) {
      try {
        const [fc] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 5_000 }),
          anyUpload.click(),
        ]);
        await fc.setFiles(videoPath);
        return;
      } catch { /* retry */ }
    }

    await sleep(1000);
  }
  throw new Error(`未找到快手上传控件。当前 URL: ${page.url()}`);
}

// ─── 主发布函数 ────────────────────────────────────────────────

export async function publishKuaishouVideo(
  opts: KuaishouPublishOptions
): Promise<PublishResult> {
  const storagePath = resolveKuaishouCookiePath(opts.account);
  const videoPath = path.resolve(opts.videoFile);
  if (!fs.existsSync(videoPath))
    throw new Error(`Video not found: ${videoPath}`);

  const total = 8;
  emit(1, total, "INIT", "检查参数");
  emit(1, total, "INIT", "OK", true);

  emit(2, total, "COOKIE_CHECK", "校验快手登录态");
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
    locale: "zh-CN",
    viewport: { width: 1366, height: 900 },
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

    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    await sleep(3000);

    const needLogin = await detectKuaishouNeedLogin(page);
    if (needLogin) {
      console.log("[kuaishou] 上传页未登录（检测到「去上传」或跳转登录页），需要扫码…");
      emit(3, total, "COOKIE_REFRESH", "需要扫码登录");
      await page.goto(LOGIN_URL, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await waitForKuaishouQrCode(page);
      await waitUntilKuaishouLoggedIn(page);
      await ctx.storageState({ path: storagePath });
      console.log("[kuaishou] Cookie 已更新");
      await page.goto(UPLOAD_URL, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      await sleep(3000);
    }

    emit(5, total, "UPLOAD_START", path.basename(videoPath));
    await waitForKuaishouUploadControl(page, videoPath);
    await sleep(2000);

    await dismissKnowButton(page);
    await closeGuideOverlay(page);

    const desc = opts.description ?? opts.title;
    await fillDescriptionAndTags(page, desc, opts.tags);

    emit(6, total, "UPLOAD_TRANSFERRING", "等待视频上传完成");
    await waitForUploadComplete(page, videoPath);

    if (opts.schedule) {
      await setScheduleKuaishou(page, opts.schedule);
    }

    emit(7, total, "PUBLISHING", "发布");
    await clickPublishKuaishou(page);

    await ctx.storageState({ path: storagePath });
    emit(8, total, "DONE", "成功", true);
    return {
      platform: "kuaishou",
      reviewUrl: page.url(),
    };
  } finally {
    await ctx.close();
    await browser.close();
  }
}
