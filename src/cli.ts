#!/usr/bin/env node
import { Command } from "commander";
import {
  cookieAuth as tencentCookieAuth,
  loginAndSaveCookie as tencentLogin,
  publishTencentVideo,
} from "./platforms/tencent.js";
import {
  cookieAuth as douyinCookieAuth,
  loginAndSaveCookie as douyinLogin,
  publishDouyinVideo,
} from "./platforms/douyin.js";
import {
  cookieAuth as kuaishouCookieAuth,
  loginAndSaveCookie as kuaishouLogin,
  publishKuaishouVideo,
} from "./platforms/kuaishou.js";
import {
  resolveTencentCookiePath,
  resolveDouyinCookiePath,
  resolveKuaishouCookiePath,
} from "./paths.js";
import { runFromConfigFile } from "./orchestrator.js";

/** 扫码登录落盘后，默认再跑一次无头 cookie 校验（可 --skip-verify 关闭）。 */
async function loginThenVerifyCookie(opts: {
  label: string;
  path: string;
  skipVerify: boolean;
  login: (p: string) => Promise<void>;
  check: (p: string) => Promise<boolean>;
}): Promise<void> {
  await opts.login(opts.path);
  console.log(`[${opts.label}] saved ${opts.path}`);
  if (opts.skipVerify) {
    console.log(`[${opts.label}] skipped post-login cookie check (--skip-verify)`);
    return;
  }
  console.log(`[${opts.label}] post-login cookie check (headless)...`);
  const ok = await opts.check(opts.path);
  console.log(`[${opts.label}] cookie_check: ${ok ? "valid" : "invalid"}`);
  if (!ok) {
    console.error(
      `[${opts.label}] Cookie file was written but check failed. Try again or run: social-publish ${opts.label} check --account <same>`
    );
    process.exit(1);
  }
}

function parseTags(s?: string): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function parseSchedule(raw?: string): Date | undefined {
  if (!raw?.trim()) return undefined;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`Invalid --schedule "${raw}". Use YYYY-MM-DD HH:mm`);
  const [, y, mo, d, h, mi] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    0,
    0
  );
}

const program = new Command();
program
  .name("social-publish")
  .description("Standalone social publish CLI (TypeScript + Playwright)");

// ─── 微信视频号 ────────────────────────────────────────────────

const tencent = program.command("tencent").description("微信视频号");

tencent
  .command("check")
  .requiredOption("--account <name>", "账号名或 cookie JSON 路径")
  .action(async (opts) => {
    const p = resolveTencentCookiePath(opts.account);
    const ok = await tencentCookieAuth(p);
    console.log(ok ? "valid" : "invalid");
    process.exit(ok ? 0 : 1);
  });

tencent
  .command("login")
  .requiredOption("--account <name>", "账号名")
  .option("--skip-verify", "仅保存 storageState，保存后不跑无头校验")
  .action(async (opts) => {
    const p = resolveTencentCookiePath(opts.account);
    await loginThenVerifyCookie({
      label: "tencent",
      path: p,
      skipVerify: Boolean(opts.skipVerify),
      login: tencentLogin,
      check: tencentCookieAuth,
    });
  });

tencent
  .command("upload")
  .requiredOption("--account <name>", "账号名")
  .requiredOption("--file <path>", "视频文件")
  .requiredOption("--title <t>", "标题")
  .option("--tags <csv>", "逗号分隔话题")
  .option("--schedule <t>", "定时 YYYY-MM-DD HH:mm")
  .option("--category <c>", "原创类型（可选）")
  .option("--draft", "存草稿")
  .action(async (opts) => {
    await publishTencentVideo({
      account: opts.account,
      videoFile: opts.file,
      title: opts.title,
      tags: parseTags(opts.tags),
      schedule: parseSchedule(opts.schedule),
      category: opts.category,
      draft: Boolean(opts.draft),
    });
  });

// ─── 抖音 ──────────────────────────────────────────────────────

const douyin = program.command("douyin").description("抖音创作者平台");

douyin
  .command("check")
  .requiredOption("--account <name>", "账号名或 cookie JSON 路径")
  .action(async (opts) => {
    const p = resolveDouyinCookiePath(opts.account);
    const ok = await douyinCookieAuth(p);
    console.log(ok ? "valid" : "invalid");
    process.exit(ok ? 0 : 1);
  });

douyin
  .command("login")
  .requiredOption("--account <name>", "账号名")
  .option("--skip-verify", "仅保存 storageState，保存后不跑无头校验")
  .action(async (opts) => {
    const p = resolveDouyinCookiePath(opts.account);
    await loginThenVerifyCookie({
      label: "douyin",
      path: p,
      skipVerify: Boolean(opts.skipVerify),
      login: douyinLogin,
      check: douyinCookieAuth,
    });
  });

douyin
  .command("upload")
  .requiredOption("--account <name>", "账号名")
  .requiredOption("--file <path>", "视频文件")
  .requiredOption("--title <t>", "标题")
  .option("--desc <d>", "描述（默认同标题）")
  .option("--tags <csv>", "逗号分隔话题")
  .option("--schedule <t>", "定时 YYYY-MM-DD HH:mm")
  .action(async (opts) => {
    await publishDouyinVideo({
      account: opts.account,
      videoFile: opts.file,
      title: opts.title,
      description: opts.desc,
      tags: parseTags(opts.tags),
      schedule: parseSchedule(opts.schedule),
    });
  });

// ─── 快手 ──────────────────────────────────────────────────────

const kuaishou = program.command("kuaishou").description("快手创作者平台");

kuaishou
  .command("check")
  .requiredOption("--account <name>", "账号名或 cookie JSON 路径")
  .action(async (opts) => {
    const p = resolveKuaishouCookiePath(opts.account);
    const ok = await kuaishouCookieAuth(p);
    console.log(ok ? "valid" : "invalid");
    process.exit(ok ? 0 : 1);
  });

kuaishou
  .command("login")
  .requiredOption("--account <name>", "账号名")
  .option("--skip-verify", "仅保存 storageState，保存后不跑无头校验")
  .action(async (opts) => {
    const p = resolveKuaishouCookiePath(opts.account);
    await loginThenVerifyCookie({
      label: "kuaishou",
      path: p,
      skipVerify: Boolean(opts.skipVerify),
      login: kuaishouLogin,
      check: kuaishouCookieAuth,
    });
  });

kuaishou
  .command("upload")
  .requiredOption("--account <name>", "账号名")
  .requiredOption("--file <path>", "视频文件")
  .requiredOption("--title <t>", "标题")
  .option("--desc <d>", "描述（默认同标题）")
  .option("--tags <csv>", "逗号分隔话题")
  .option("--schedule <t>", "定时 YYYY-MM-DD HH:mm")
  .action(async (opts) => {
    await publishKuaishouVideo({
      account: opts.account,
      videoFile: opts.file,
      title: opts.title,
      description: opts.desc,
      tags: parseTags(opts.tags),
      schedule: parseSchedule(opts.schedule),
    });
  });

// ─── 三平台扫码登录链路验收（交互式，按顺序执行）────────────────

program
  .command("verify-scan-login")
  .description(
    "依次：视频号 → 抖音 → 快手；每站打开浏览器扫码。抖音/快手默认轮询登录态后保存；视频号常需 Inspector Resume 或 SOCIAL_PUBLISH_LOGIN_STDIN=1；每站保存后无头校验 cookie（可用 --skip-verify 跳过）"
  )
  .requiredOption("--account <name>", "统一账号别名（三站 cookie 各存一份）")
  .option("--skip-verify", "每站仅保存，不做保存后无头校验（不推荐）")
  .action(async (opts) => {
    const skip = Boolean(opts.skipVerify);
    const account = opts.account as string;
    const steps: Array<{
      label: string;
      path: string;
      login: (p: string) => Promise<void>;
      check: (p: string) => Promise<boolean>;
    }> = [
      {
        label: "tencent",
        path: resolveTencentCookiePath(account),
        login: tencentLogin,
        check: tencentCookieAuth,
      },
      {
        label: "douyin",
        path: resolveDouyinCookiePath(account),
        login: douyinLogin,
        check: douyinCookieAuth,
      },
      {
        label: "kuaishou",
        path: resolveKuaishouCookiePath(account),
        login: kuaishouLogin,
        check: kuaishouCookieAuth,
      },
    ];

    console.log(
      "\n将依次验证三平台「扫码登录 → 写 cookie → 校验」。同一账号名会写入三个不同目录下的 JSON。\n"
    );
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]!;
      console.log(
        `\n────────── [${i + 1}/${steps.length}] ${s.label} ──────────`
      );
      await loginThenVerifyCookie({
        label: s.label,
        path: s.path,
        skipVerify: skip,
        login: s.login,
        check: s.check,
      });
    }
    console.log(
      skip
        ? "\n✅ verify-scan-login：三平台均已保存 storageState（已跳过无头校验）。\n"
        : "\n✅ verify-scan-login：三平台扫码存储与无头校验均通过。\n"
    );
  });

// ─── 编排 ──────────────────────────────────────────────────────

program
  .command("orchestrate")
  .requiredOption("--config <path>", "JSON 配置文件")
  .action(async (opts) => {
    await runFromConfigFile(opts.config);
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
