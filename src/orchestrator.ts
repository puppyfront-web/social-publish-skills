import fs from "node:fs";
import { publishTencentVideo } from "./platforms/tencent.js";
import { publishDouyinVideo } from "./platforms/douyin.js";
import { publishKuaishouVideo } from "./platforms/kuaishou.js";

const SCHEDULE = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})$/;

export type OrchestratorTask = {
  platform: string;
  account: string;
  video_file: string;
  title: string;
  description?: string;
  tags?: string;
  schedule?: string;
  category?: string;
  draft?: boolean;
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

export async function runFromConfigFile(configPath: string): Promise<void> {
  const text = fs.readFileSync(configPath, "utf-8");
  const cfg = JSON.parse(text) as OrchestratorConfig;
  if (cfg.data_dir) process.env.SOCIAL_PUBLISH_DATA_DIR = cfg.data_dir;

  for (const t of cfg.tasks ?? []) {
    const platform = t.platform.toLowerCase();
    const tags = parseTags(t.tags);
    const schedule = parseSchedule(t.schedule) ?? undefined;

    switch (platform) {
      case "tencent":
        await publishTencentVideo({
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
        await publishDouyinVideo({
          account: t.account,
          videoFile: t.video_file,
          title: t.title,
          description: t.description,
          tags,
          schedule,
        });
        break;
      case "kuaishou":
        await publishKuaishouVideo({
          account: t.account,
          videoFile: t.video_file,
          title: t.title,
          description: t.description,
          tags,
          schedule,
        });
        break;
      default:
        throw new Error(`Unknown platform: ${t.platform}`);
    }
  }
}
