import { describe, expect, it } from "vitest";
import {
  announcementStatus,
  isAnnouncementActive,
  parseAnnouncementInput,
  localizeAnnouncement,
  sortAnnouncements,
} from "./schema";

const NOW = new Date("2026-10-12T03:00:00Z");
const ok = (body: unknown) => {
  const r = parseAnnouncementInput(body, NOW);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("parseAnnouncementInput", () => {
  it("タイトルと本文だけで、すぐ公開・終了日なしになる", () => {
    expect(ok({ title: " 雨天中止 ", body: " 10月19日は中止です " })).toEqual({
      title: "雨天中止",
      body: "10月19日は中止です",
      important: false,
      published: true,
      startsAt: NOW.toISOString(),
      endsAt: null,
      titleEn: null,
      bodyEn: null,
      translationStatus: null,
      englishProvided: false,
    });
  });

  it("英語版: 両方あれば受け取り（状態の既定は手直し済み）、両方空なら null にする", () => {
    expect(ok({ title: "a", body: "b", titleEn: " Cancelled ", bodyEn: " Rain ", translationStatus: "auto" })).toMatchObject({
      titleEn: "Cancelled",
      bodyEn: "Rain",
      translationStatus: "auto",
    });
    expect(ok({ title: "a", body: "b", titleEn: "T", bodyEn: "B" }).translationStatus).toBe("auto");
    expect(ok({ title: "a", body: "b", titleEn: "T", bodyEn: "B", translationStatus: "stale" }).translationStatus).toBe("stale");
    expect(ok({ title: "a", body: "b", titleEn: "", bodyEn: " ", translationStatus: "auto" })).toMatchObject({
      titleEn: null,
      bodyEn: null,
      translationStatus: null,
    });
  });

  it("英語版: 片方だけ・長すぎる・状態が不正なものは受け付けない", () => {
    for (const bad of [
      { titleEn: "T" },
      { bodyEn: "B" },
      { titleEn: "T".repeat(241), bodyEn: "B" },
      { titleEn: "T", bodyEn: "B".repeat(8001) },
      { titleEn: "T", bodyEn: "B", translationStatus: "weird" },
    ]) {
      expect(parseAnnouncementInput({ title: "a", body: "b", ...bad }, NOW).ok).toBe(false);
    }
  });

  it("公開期間・重要・下書きを受け取る", () => {
    const v = ok({ title: "a", body: "b", important: true, published: false, startsAt: "2026-10-18T00:00:00+09:00", endsAt: "2026-10-20T00:00:00+09:00" });
    expect(v).toMatchObject({ important: true, published: false, startsAt: "2026-10-17T15:00:00.000Z", endsAt: "2026-10-19T15:00:00.000Z" });
  });

  it("タイトル・本文の長さ、日時の形、終了が開始より後かを確かめる", () => {
    for (const bad of [
      {},
      { title: "", body: "b" },
      { title: "a", body: " " },
      { title: "あ".repeat(81), body: "b" },
      { title: "a", body: "あ".repeat(2001) },
      { title: "a", body: "b", startsAt: "いつか" },
      { title: "a", body: "b", endsAt: "x" },
      { title: "a", body: "b", startsAt: "2026-10-20T00:00:00Z", endsAt: "2026-10-19T00:00:00Z" },
      { title: "a", body: "b", startsAt: "2026-10-20T00:00:00Z", endsAt: "2026-10-20T00:00:00Z" },
      { title: "a", body: "b", important: "yes" },
      { title: "a", body: "b", published: 1 },
    ]) {
      expect(parseAnnouncementInput(bad, NOW).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("公開中の判定", () => {
  const base = { published: true, startsAt: "2026-10-10T00:00:00Z", endsAt: null as string | null };

  it("公開にしてあって、期間の中なら公開中", () => {
    expect(isAnnouncementActive(base, NOW)).toBe(true);
    expect(announcementStatus(base, NOW)).toBe("active");
  });

  it("下書き・取り下げは、期間の中でも出さない", () => {
    expect(isAnnouncementActive({ ...base, published: false }, NOW)).toBe(false);
    expect(announcementStatus({ ...base, published: false }, NOW)).toBe("hidden");
  });

  it("開始前は出さない（公開前）。終了日時ちょうどからは出さない（終了）", () => {
    expect(announcementStatus({ ...base, startsAt: "2026-10-13T00:00:00Z" }, NOW)).toBe("scheduled");
    expect(isAnnouncementActive({ ...base, startsAt: "2026-10-13T00:00:00Z" }, NOW)).toBe(false);
    expect(announcementStatus({ ...base, endsAt: "2026-10-12T03:00:00Z" }, NOW)).toBe("ended");
    expect(isAnnouncementActive({ ...base, endsAt: "2026-10-12T03:00:01Z" }, NOW)).toBe(true);
  });
});

describe("sortAnnouncements", () => {
  it("重要なものを先に、その中は新しい順", () => {
    const list = [
      { id: "old", important: false, startsAt: "2026-10-01T00:00:00Z" },
      { id: "new", important: false, startsAt: "2026-10-10T00:00:00Z" },
      { id: "imp-old", important: true, startsAt: "2026-09-01T00:00:00Z" },
    ];
    expect(sortAnnouncements(list).map((a) => a.id)).toEqual(["imp-old", "new", "old"]);
  });
});

describe("localizeAnnouncement", () => {
  const a = { title: "雨天中止", body: "中止です", titleEn: "Cancelled", bodyEn: "Rain", translationStatus: "reviewed" as const };
  it("英語で、英語版がそろっているときだけ英語にする", () => {
    expect(localizeAnnouncement(a, "en")).toEqual({ title: "Cancelled", body: "Rain", lang: "en" });
    expect(localizeAnnouncement({ ...a, bodyEn: null }, "en")).toMatchObject({ title: "雨天中止", lang: "ja" });
    expect(localizeAnnouncement({ ...a, translationStatus: "stale" }, "en")).toMatchObject({ title: "雨天中止", lang: "ja" });
    expect(localizeAnnouncement(a, "ja")).toMatchObject({ title: "雨天中止", lang: "ja" });
  });
});
