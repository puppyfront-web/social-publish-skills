import test from "node:test";
import assert from "node:assert/strict";
import {
  isZhihuLoginUrl,
  isZhihuSafetyVerificationUrl,
  isZhihuWriteUrl,
  normalizeZhihuArticleUrl,
} from "../dist/platforms/zhihu.js";

test("isZhihuLoginUrl detects common login pages", () => {
  assert.equal(isZhihuLoginUrl("https://www.zhihu.com/signin?next=%2Fcreator"), true);
  assert.equal(isZhihuLoginUrl("https://www.zhihu.com/login"), true);
  assert.equal(isZhihuLoginUrl("https://www.zhihu.com/creator"), false);
});

test("isZhihuWriteUrl detects article editors", () => {
  assert.equal(isZhihuWriteUrl("https://zhuanlan.zhihu.com/write"), true);
  assert.equal(isZhihuWriteUrl("https://www.zhihu.com/creator/content/article"), true);
  assert.equal(isZhihuWriteUrl("https://www.zhihu.com/creator"), false);
});

test("isZhihuSafetyVerificationUrl detects unhuman verification pages", () => {
  assert.equal(
    isZhihuSafetyVerificationUrl("https://www.zhihu.com/account/unhuman?type=Q8J2L3&need_login=false"),
    true
  );
  assert.equal(isZhihuSafetyVerificationUrl("https://www.zhihu.com/creator"), false);
});

test("normalizeZhihuArticleUrl strips query and hash from publish result URLs", () => {
  assert.equal(
    normalizeZhihuArticleUrl("https://zhuanlan.zhihu.com/p/123456?utm_id=abc#comments"),
    "https://zhuanlan.zhihu.com/p/123456"
  );
  assert.equal(
    normalizeZhihuArticleUrl("https://www.zhihu.com/creator"),
    "https://www.zhihu.com/creator"
  );
});
