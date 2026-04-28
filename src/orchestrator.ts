import fs from "node:fs";
import { publishTencentVideo } from "./platforms/tencent.js";
import { publishDouyinVideo } from "./platforms/douyin.js";
import { publishKuaishouVideo } from "./platforms/kuaishou.js";
import { publishWechatArticle } from "./platforms/wechatmp.js";
import { logPublishResult, type PublishResult } from "./publish-result.js";

const SCHEDULE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/;

export type OrchestratorTask = {
  platform: string;
  account: string;
  title?: string;
  video_file?: string;
  description?: string;
  tags?: string;
  schedule?: string;
  category?: string;
  draft?: boolean;
  source?: string;
  source_type?: "auto" | "markdown" | "github" | "url";
  author?: string;
  digest?: string;
  publish?: boolean;
};

export type OrchestratorConfig = {
  data_dir?: string;
  tasks: OrchestratorTask[];
};

function parseTags(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function parseSchedule(raw?: string): Date | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(SCHEDULE);
  if (!m) throw new Error(`Invalid schedule "${raw}". Use YYYY-MM-DD HH:mm`);
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

function expectString(task: OrchestratorTask, field: keyof OrchestratorTask): string {
  const value = task[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid task for platform "${task.platform}": missing "${String(field)}"`);
  }
  return value.trim();
}

export async function runFromConfigFile(configPath: string): Promise<void> {
  const text = fs.readFileSync(configPath, "utf-8");
  const cfg = JSON.parse(text) as OrchestratorConfig;
  if (cfg.data_dir) process.env.SOCIAL_PUBLISH_DATA_DIR = cfg.data_dir;

  for (const t of cfg.tasks ?? []) {
    const platform = t.platform.toLowerCase();
    const tags = parseTags(t.tags);
    const schedule = parseSchedule(t.schedule) ?? undefined;
    let result: PublishResult;

    switch (platform) {
      case "tencent":
        if (!t.video_file) {
          throw new Error(`Invalid task for platform "${t.platform}": missing "video_file"`);
        }
        if (!t.title) {
          throw new Error(`Invalid task for platform "${t.platform}": missing "title"`);
        }
        result = await publishTencentVideo({
          account: t.account,
          videoFile: t.video_file,
          title: t.title,
          tags,
          schedule,
          category: t.category,
          draft: t.draft,
        });
        break;
      case "douyin":
        if (!t.video_file) {
          throw new Error(`Invalid task for platform "${t.platform}": missing "video_file"`);
        }
        if (!t.title) {
          throw new Error(`Invalid task for platform "${t.platform}": missing "title"`);
        }
        result = await publishDouyinVideo({
          account: t.account,
          videoFile: t.video_file,
          title: t.title,
          description: t.description,
          tags,
          schedule,
        });
        break;
      case "kuaishou":
        if (!t.video_file) {
          throw new Error(`Invalid task for platform "${t.platform}": missing "video_file"`);
        }
        if (!t.title) {
          throw new Error(`Invalid task for platform "${t.platform}": missing "title"`);
        }
        result = await publishKuaishouVideo({
          account: t.account,
          videoFile: t.video_file,
          title: t.title,
          description: t.description,
          tags,
          schedule,
        });
        break;
      case "wechatmp":
        result = await publishWechatArticle({
          account: t.account,
          source: expectString(t, "source"),
          sourceType: t.source_type ?? "auto",
          title: expectString(t, "title"),
          author: t.author,
          digest: t.digest,
          publish: Boolean(t.publish),
        });
        break;
      default:
        throw new Error(`Unknown platform: ${t.platform}`);
    }

    logPublishResult(result);
  }
}
