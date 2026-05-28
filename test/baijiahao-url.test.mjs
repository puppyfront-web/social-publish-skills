import test from "node:test";
import assert from "node:assert/strict";
import {
  isBaijiahaoEditorUrl,
  isBaijiahaoLoginUrl,
  isBaijiahaoSafetyVerificationUrl,
  normalizeBaijiahaoArticleUrl,
} from "../dist/platforms/baijiahao.js";

test("isBaijiahaoLoginUrl detects common login pages", () => {
  assert.equal(isBaijiahaoLoginUrl("https://baijiahao.baidu.com/builder/theme/bjh/login"), true);
  assert.equal(isBaijiahaoLoginUrl("https://baijiahao.baidu.com/builder/app/login"), true);
  assert.equal(isBaijiahaoLoginUrl("https://baijiahao.baidu.com/builder/rc/home"), false);
});

test("isBaijiahaoEditorUrl detects article editors", () => {
  assert.equal(isBaijiahaoEditorUrl("https://baijiahao.baidu.com/builder/rc/edit?type=news"), true);
  assert.equal(isBaijiahaoEditorUrl("https://baijiahao.baidu.com/builder/rc/edit?type=video"), true);
  assert.equal(isBaijiahaoEditorUrl("https://baijiahao.baidu.com/builder/rc/home"), false);
});

test("isBaijiahaoSafetyVerificationUrl detects Baidu security pages", () => {
  assert.equal(isBaijiahaoSafetyVerificationUrl("https://wappass.baidu.com/static/captcha/tuxing.html"), true);
  assert.equal(isBaijiahaoSafetyVerificationUrl("https://baijiahao.baidu.com/builder/rc/home"), false);
});

test("normalizeBaijiahaoArticleUrl strips query and hash from article URLs", () => {
  assert.equal(
    normalizeBaijiahaoArticleUrl("https://baijiahao.baidu.com/s?id=1234567890&wfr=spider#comment"),
    "https://baijiahao.baidu.com/s?id=1234567890"
  );
  assert.equal(
    normalizeBaijiahaoArticleUrl("https://baijiahao.baidu.com/builder/rc/edit?type=news"),
    "https://baijiahao.baidu.com/builder/rc/edit?type=news"
  );
});
