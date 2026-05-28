import test from "node:test";
import assert from "node:assert/strict";
import {
  extractWechatToken,
  hasAuthenticatedBackendUrl,
} from "../dist/platforms/wechatmp.js";

test("extractWechatToken returns token from backend url", () => {
  assert.equal(
    extractWechatToken("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=123456"),
    "123456"
  );
});

test("extractWechatToken returns null when token is missing", () => {
  assert.equal(
    extractWechatToken("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN"),
    null
  );
});

test("hasAuthenticatedBackendUrl requires both backend path and token", () => {
  assert.equal(
    hasAuthenticatedBackendUrl("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN&token=123456"),
    true
  );
  assert.equal(
    hasAuthenticatedBackendUrl("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN"),
    false
  );
  assert.equal(
    hasAuthenticatedBackendUrl("https://mp.weixin.qq.com/cgi-bin/readtemplate?t=home/index_tmpl&lang=zh_CN&token=123456"),
    false
  );
});
