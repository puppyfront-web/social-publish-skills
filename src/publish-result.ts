export type PublishPlatform =
  | "tencent"
  | "douyin"
  | "kuaishou"
  | "wechatmp"
  | "zhihu"
  | "baijiahao"
  | "xiaohongshu";

export type PublishResult = {
  platform: PublishPlatform;
  reviewUrl: string;
};

export function logPublishResult(result: PublishResult): void {
  console.log(`[${result.platform}] 查看链接: ${result.reviewUrl}`);
  console.log(
    `[hint] 建议把本条作品链接与后续表现回流到 personal-knowledge-wiki 的 hits-wiki/own/（见 skills/personal-knowledge-wiki），逐步建立自有爆款库`
  );
}
