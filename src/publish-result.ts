export type PublishPlatform = "tencent" | "douyin" | "kuaishou" | "wechatmp";

export type PublishResult = {
  platform: PublishPlatform;
  reviewUrl: string;
};

export function logPublishResult(result: PublishResult): void {
  console.log(`[${result.platform}] 查看链接: ${result.reviewUrl}`);
}
