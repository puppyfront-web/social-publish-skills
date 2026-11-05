import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDashboardMetrics,
  parseProfileCounts,
  parseFansData,
  parseNoteList,
} from "../dist/platforms/xiaohongshu-stats.js";

const HOME_TEXT = `创作服务平台
AI小黄鸭 | 回归基本功的李老师
118
关注数
659
粉丝数
1668
获赞与收藏
小红书账号: 741859291
笔记数据总览
统计周期 10-29 至 11-04
近7日
近30日
曝光数
9,349
环比+39%
观看数
1,200
环比+79%
封面点击率
8%
环比-5%
净涨粉
13
环比+0%
主页访客
282
环比-20%`;

const FANS_TEXT = `粉丝数据概览
近7天
近30天
总粉丝数
659
新增粉丝数
13
流失粉丝数
0
粉丝画像
性别分布
男性 60%
女性 40%
年龄分布
兴趣分布
职场
生活记录
科技数码
地域分布
完整地域数据，请去小红书APP-创作中心查看
粉丝来源
首页推荐 29.59%
搜索 28.57%
个人主页 22.45%
其他来源 15.31%
视频推荐 4.08%
我的活跃粉丝
近7天
近30天
cu
互动
4
次
LINGYIYI
互动
3
次`;

const NOTES_TEXT = `全部 136
已发布
审核中
未通过
置顶
大家用AI做了哪些好用好玩的事情？？？
2026-11-04 10:13
31
0
1
0
2
01:20
remotion生视频分享案例
2026-11-05 15:48
45
2
2
2
0
Vibe Coding UI设计年度伟大发现-Stitch
2026-10-30 11:57
496
4
25
24
5
回乡记录一下
2026-08-18 18:19
30
0
0
0
0
仅自己可见
正在加载中...`;

test("parseProfileCounts reads counts from the line above each label", () => {
  assert.deepEqual(parseProfileCounts(HOME_TEXT), {
    关注数: "118",
    粉丝数: "659",
    获赞与收藏: "1668",
  });
});

test("parseDashboardMetrics reads value lines after each metric label", () => {
  const m = parseDashboardMetrics(HOME_TEXT);
  assert.equal(m["曝光数"], "9,349");
  assert.equal(m["观看数"], "1,200");
  assert.equal(m["封面点击率"], "8%");
  assert.equal(m["净涨粉"], "13");
  assert.equal(m["主页访客"], "282");
  assert.equal(m["点赞数"], undefined);
});

test("parseFansData parses counts, gender, interests, sources and active fans", () => {
  const f = parseFansData(FANS_TEXT);
  assert.equal(f.totalFans, 659);
  assert.equal(f.newFans, 13);
  assert.equal(f.lostFans, 0);
  assert.deepEqual(f.gender, { male: 60, female: 40 });
  assert.deepEqual(f.interests, ["职场", "生活记录", "科技数码"]);
  assert.deepEqual(f.sources[0], { name: "首页推荐", percent: 29.59 });
  assert.equal(f.sources.length, 5);
  assert.deepEqual(f.activeFans[0], { name: "cu", interactions: 4 });
  assert.equal(f.activeFans.length, 2);
});

test("parseNoteList maps note rows to typed stats with duration and selfOnly flags", () => {
  const { notes, total } = parseNoteList(NOTES_TEXT);
  assert.equal(total, 136);
  assert.equal(notes.length, 4);
  assert.deepEqual(notes[0], {
    title: "大家用AI做了哪些好用好玩的事情？？？",
    publishedAt: "2026-11-04 10:13",
    views: 31,
    likes: 0,
    collects: 1,
    comments: 0,
    shares: 2,
    duration: "01:20",
  });
  assert.deepEqual(notes[1], {
    title: "remotion生视频分享案例",
    publishedAt: "2026-11-05 15:48",
    views: 45,
    likes: 2,
    collects: 2,
    comments: 2,
    shares: 0,
  });
  assert.equal(notes[2].title, "Vibe Coding UI设计年度伟大发现-Stitch");
  assert.equal(notes[2].views, 496);
  assert.equal(notes[3].selfOnly, true);
});

test("parseNoteList returns empty when pinned tab marker is missing", () => {
  assert.deepEqual(parseNoteList("全部 136\n已发布"), { notes: [], total: null });
});
