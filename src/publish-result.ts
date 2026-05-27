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
}
