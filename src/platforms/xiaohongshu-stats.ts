/**
 * 小红书创作者后台数据抓取：账号总览（7/30日）+ 粉丝画像 + 笔记管理列表。
 * 产物为账号快照 JSON，写入账号档案目录，供复盘 Skill 消费。
 * 解析基于页面 innerText，字段缺失保持 null，不猜测填充。
 */
import fs from "node:fs";
import path from "node:path";
import { type Page } from "playwright";
import { launchBrowser, applyStealthScript } from "../browser.js";
import { getDataDir } from "../config.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HOME_URL = "https://creator.xiaohongshu.com/new/home";
const FANS_URL = "https://creator.xiaohongshu.com/statistics/fans-data";
const NOTES_URL = "https://creator.xiaohongshu.com/new/note-manager";

/** 首页总览指标键 → 后台文案 */
const DASHBOARD_KEYS = [
  "曝光数",
  "观看数",
  "封面点击率",
  "视频完播率",
  "点赞数",
  "评论数",
  "收藏数",
  "分享数",
  "净涨粉",
  "新增关注",
  "取消关注",
  "主页访客",
] as const;

const COUNT_KEYS = ["关注数", "粉丝数", "获赞与收藏"] as const;

const NUMBER_VALUE = /^[\d,.]+[%]?万?$/;
const DATE_LINE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const DURATION_LINE = /^\d{1,2}:\d{2}$/;
const PERCENT_SOURCE = /^(.+?)\s([\d.]+)%$/;

export type DashboardMetrics = Partial<Record<(typeof DASHBOARD_KEYS)[number], string>>;
export type ProfileCounts = Partial<Record<(typeof COUNT_KEYS)[number], string>>;

export interface NoteStat {
  title: string;
  publishedAt: string;
  views: number | null;
  likes: number | null;
  collects: number | null;
  comments: number | null;
  shares: number | null;
  duration?: string;
  selfOnly?: boolean;
}

export interface FansData {
  totalFans: number | null;
  newFans: number | null;
  lostFans: number | null;
  gender: { male: number | null; female: number | null };
  interests: string[];
  sources: Array<{ name: string; percent: number }>;
  activeFans: Array<{ name: string; interactions: number }>;
}

export interface CreatorSnapshot {
  platform: "xiaohongshu";
  account: string;
  captured_at: string;
  source: "creator_center";
  profile_counts: ProfileCounts;
  overview: { last7d: DashboardMetrics; last30d: DashboardMetrics };
  fans: FansData;
  notes: NoteStat[];
  notes_loaded: number;
  notes_total: number | null;
}

const toInt = (s: string | undefined | null): number | null => {
  if (s == null) return null;
  const m = String(s).replace(/,/g, "").match(/[\d.]+/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? Math.round(s.includes("万") ? n * 10000 : n) : null;
};

function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText().catch(() => "");
}

/** 解析首页「笔记数据总览」块：标签行的下一行是值，值后可能有「环比±N%」。 */
export function parseDashboardMetrics(text: string): DashboardMetrics {
  const lines = text.split("\n").map((l) => l.trim());
  const out: DashboardMetrics = {};
  for (const key of DASHBOARD_KEYS) {
    const i = lines.findIndex((l) => l === key);
    if (i >= 0 && i + 1 < lines.length && NUMBER_VALUE.test(lines[i + 1])) {
      out[key] = lines[i + 1];
    }
  }
  return out;
}

/** 解析首页头部计数：值在标签行的上一行。 */
export function parseProfileCounts(text: string): ProfileCounts {
  const lines = text.split("\n").map((l) => l.trim());
  const out: ProfileCounts = {};
  for (const key of COUNT_KEYS) {
    const i = lines.findIndex((l) => l === key);
    if (i > 0 && /^[\d,]+$/.test(lines[i - 1])) out[key] = lines[i - 1];
  }
  return out;
}

/** 解析粉丝数据页：计数、性别、兴趣、来源、活跃粉丝。 */
export function parseFansData(text: string): FansData {
  const lines = text.split("\n").map((l) => l.trim());
  const valueAfter = (key: string): number | null => {
    const i = lines.findIndex((l) => l === key);
    return i >= 0 && i + 1 < lines.length ? toInt(lines[i + 1]) : null;
  };
  const section = (startMark: string, endMark: string): string[] => {
    const s = lines.findIndex((l) => l.includes(startMark));
    const e = endMark ? lines.findIndex((l) => l.includes(endMark)) : -1;
    if (s < 0) return [];
    return lines.slice(s + 1, e > s ? e : undefined);
  };
  const male = lines.find((l) => /^男性\s?\d+%/.test(l));
  const female = lines.find((l) => /^女性\s?\d+%/.test(l));

  const sources = section("粉丝来源", "我的活跃粉丝")
    .map((l) => l.match(PERCENT_SOURCE))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ name: m[1].trim(), percent: Number(m[2]) }));

  const activeFans: Array<{ name: string; interactions: number }> = [];
  const fanLines = section("我的活跃粉丝", "");
  for (let i = 0; i < fanLines.length - 2; i++) {
    if (fanLines[i + 1] === "互动") {
      const n = toInt(fanLines[i + 2]);
      if (n != null && fanLines[i]) activeFans.push({ name: fanLines[i], interactions: n });
    }
  }

  return {
    totalFans: valueAfter("总粉丝数"),
    newFans: valueAfter("新增粉丝数"),
    lostFans: valueAfter("流失粉丝数"),
    gender: { male: toInt((male || "").match(/\d+/)?.[0]), female: toInt((female || "").match(/\d+/)?.[0]) },
    interests: section("兴趣分布", "地域分布").filter((l) => l && !/^\d/.test(l)),
    sources,
    activeFans,
  };
}

/** 解析笔记管理列表：标题行 + 日期行 + 5个计数列（阅读/赞/藏/评/享）+ 可选时长与仅自己可见。 */
export function parseNoteList(text: string): { notes: NoteStat[]; total: number | null } {
  const lines = text.split("\n").map((l) => l.trim());
  // tab 行随改版增减（新版无「置顶」）；起点取「全部 N」行之后最后一条状态 tab。
  const totalIdx = lines.findIndex((l) => /^全部\s+\d+$/.test(l));
  if (totalIdx < 0) return { notes: [], total: null };
  const total = toInt(lines[totalIdx].split(/\s+/)[1]);
  const statusTabs = ["已发布", "审核中", "未通过", "置顶"];
  let start = totalIdx;
  for (let i = totalIdx + 1; i < lines.length && statusTabs.includes(lines[i]); i++) start = i;

  const body = lines.slice(start + 1);
  const stopIdx = body.findIndex((l) => l === "正在加载中..." || l === "展开");
  const scoped = body.slice(0, stopIdx >= 0 ? stopIdx : undefined);

  const notes: NoteStat[] = [];
  for (let i = 0; i < scoped.length; i++) {
    if (!DATE_LINE.test(scoped[i])) continue;
    const title = scoped[i - 1] || "";
    if (!title) continue;
    const nums: number[] = [];
    let j = i + 1;
    while (j < scoped.length && nums.length < 5 && /^[\d,]+$/.test(scoped[j])) {
      nums.push(Number(scoped[j].replace(/,/g, "")));
      j++;
    }
    let duration: string | undefined;
    let selfOnly = false;
    if (j < scoped.length && DURATION_LINE.test(scoped[j])) {
      duration = scoped[j];
      j++;
    }
    if (scoped[j] === "仅自己可见") selfOnly = true;
    const [views, likes, collects, comments, shares] = nums;
    notes.push({
      title,
      publishedAt: scoped[i],
      views: views ?? null,
      likes: likes ?? null,
      collects: collects ?? null,
      comments: comments ?? null,
      shares: shares ?? null,
      ...(duration ? { duration } : {}),
      ...(selfOnly ? { selfOnly } : {}),
    });
    i = j - 1;
  }
  return { notes, total };
}

async function openAndText(page: Page, url: string, settleMs: number): Promise<string> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await sleep(settleMs);
  return bodyText(page);
}

/** 滚动笔记列表直到数量稳定或达上限（后台懒加载）。 */
async function scrollNoteList(page: Page): Promise<void> {
  let prev = -1;
  let stable = 0;
  for (let round = 0; round < 30 && stable < 3; round++) {
    await page.keyboard.press("End").catch(() => {});
    await page.mouse.wheel(0, 3000).catch(() => {});
    await sleep(1500);
    const count = await page.locator(".note-card").count().catch(() => 0);
    if (count === prev) stable++;
    else {
      stable = 0;
      prev = count;
    }
  }
}

export function snapshotDir(account: string): string {
  return path.join(getDataDir(), "accounts", "xiaohongshu", account, "snapshots");
}

/**
 * 抓取创作者后台并落盘快照。返回快照文件绝对路径。
 * 页面文案改版时字段可能缺失（保持 null），不会抛出解析错误。
 */
export async function fetchXiaohongshuCreatorStats(
  storagePath: string,
  account: string,
  outDir?: string
): Promise<string> {
  const browser = await launchBrowser(true);
  try {
    const ctx = await browser.newContext({
      storageState: storagePath,
      locale: "zh-CN",
      viewport: { width: 1440, height: 900 },
    });
    await applyStealthScript(ctx);
    const page = await ctx.newPage();

    const home7 = await openAndText(page, HOME_URL, 6000);
    await page.getByText("近30日", { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
    await sleep(3000);
    const home30 = await bodyText(page);

    const fansText = await openAndText(page, FANS_URL, 6000);

    await page.goto(NOTES_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await sleep(6000);
    await scrollNoteList(page);
    const notesText = await bodyText(page);

    const { notes, total } = parseNoteList(notesText);
    const snapshot: CreatorSnapshot = {
      platform: "xiaohongshu",
      account,
      captured_at: new Date().toISOString(),
      source: "creator_center",
      profile_counts: parseProfileCounts(home7),
      overview: { last7d: parseDashboardMetrics(home7), last30d: parseDashboardMetrics(home30) },
      fans: parseFansData(fansText),
      notes,
      notes_loaded: notes.length,
      notes_total: total,
    };

    const dir = outDir ?? snapshotDir(account);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const file = path.join(dir, `creator-center-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf8");
    return file;
  } finally {
    await browser.close();
  }
}
