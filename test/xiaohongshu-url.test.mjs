import test from "node:test";
import assert from "node:assert/strict";
import {
  buildXiaohongshuDescriptionSelectors,
  getXiaohongshuUploadWaitState,
  isXiaohongshuLoginUrl,
  isXiaohongshuPublishUrl,
  shouldXiaohongshuWaitForUpload,
  parseXiaohongshuTags,
  requireAbsoluteLocalPath,
} from "../dist/platforms/xiaohongshu.js";

test("isXiaohongshuLoginUrl detects creator login pages", () => {
  assert.equal(isXiaohongshuLoginUrl("https://creator.xiaohongshu.com/login"), true);
  assert.equal(isXiaohongshuLoginUrl("https://creator.xiaohongshu.com/publish/publish"), false);
});

test("isXiaohongshuPublishUrl detects creator publish pages", () => {
  assert.equal(isXiaohongshuPublishUrl("https://creator.xiaohongshu.com/publish/publish"), true);
  assert.equal(isXiaohongshuPublishUrl("https://creator.xiaohongshu.com/creator/home"), false);
});

test("parseXiaohongshuTags trims comma separated tags and removes hash prefix", () => {
  assert.deepEqual(parseXiaohongshuTags(" #绘本故事, 小红书 ,,"), ["绘本故事", "小红书"]);
});

test("requireAbsoluteLocalPath rejects relative local paths", () => {
  assert.throws(
    () => requireAbsoluteLocalPath("video.mp4", "video"),
    /video must be an absolute path/
  );
});

test("buildXiaohongshuDescriptionSelectors excludes the active title selector fallback", () => {
  const selectors = buildXiaohongshuDescriptionSelectors(
    "[contenteditable='true'][data-placeholder*='标题']"
  );

  assert.equal(
    selectors.includes("[contenteditable='true'][data-placeholder*='标题']"),
    false
  );
  assert.equal(selectors.includes("[contenteditable='true']"), false);
});

test("buildXiaohongshuDescriptionSelectors removes the generic contenteditable fallback for contenteditable titles", () => {
  const selectors = buildXiaohongshuDescriptionSelectors("[contenteditable='true'][placeholder*='标题']");

  assert.equal(selectors.includes("[contenteditable='true']"), false);
});

test("shouldXiaohongshuWaitForUpload keeps waiting while file input is still visible and upload never started", () => {
  assert.equal(
    shouldXiaohongshuWaitForUpload({
      pageText: "立即发布 定时发布",
      sawProcessing: false,
      fileInputVisible: true,
      readyPolls: 0,
    }),
    true
  );
});

test("shouldXiaohongshuWaitForUpload can finish after stable ready polls even if processing text was never observed", () => {
  assert.equal(
    shouldXiaohongshuWaitForUpload({
      pageText: "立即发布 定时发布",
      sawProcessing: false,
      fileInputVisible: false,
      readyPolls: 2,
    }),
    false
  );
});

test("getXiaohongshuUploadWaitState increments stable ready polls after upload starts", () => {
  const state = getXiaohongshuUploadWaitState(
    {
      sawProcessing: true,
      readyPolls: 1,
    },
    "立即发布 定时发布",
    false
  );

  assert.deepEqual(state, {
    sawProcessing: true,
    readyPolls: 2,
  });
});

test("shouldXiaohongshuWaitForUpload waits until processing text disappears after upload starts", () => {
  assert.equal(
    shouldXiaohongshuWaitForUpload({
      pageText: "上传中 立即发布",
      sawProcessing: true,
      fileInputVisible: false,
      readyPolls: 0,
    }),
    true
  );
  assert.equal(
    shouldXiaohongshuWaitForUpload({
      pageText: "立即发布 定时发布",
      sawProcessing: true,
      fileInputVisible: false,
      readyPolls: 2,
    }),
    false
  );
});
