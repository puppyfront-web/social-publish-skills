import test from "node:test";
import assert from "node:assert/strict";
import { isExactActionText } from "../dist/platforms/xiaohongshu.js";

test("isExactActionText matches only whole-text buttons", () => {
  assert.equal(isExactActionText("发布", ["发布", "立即发布"]), true);
  assert.equal(isExactActionText(" 立即发布 ", ["发布", "立即发布"]), true);
});

test("isExactActionText rejects containers and menu items containing the label", () => {
  assert.equal(isExactActionText("发布笔记", ["发布", "立即发布"]), false);
  assert.equal(isExactActionText("定时发布 发布", ["发布", "立即发布"]), false);
  assert.equal(isExactActionText("确认发布", ["发布", "立即发布"]), false);
  assert.equal(isExactActionText("发布\n", ["发布", "立即发布"]), true);
});
