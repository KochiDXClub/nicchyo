import { describe, it, expect } from "vitest";
import {
  toIsoDate,
  getUpcomingSundayIso,
  normalizeStatus,
  normalizeCategory,
  getStatusPresentation,
  getCategoryPresentation,
  shouldSurfaceOnMap,
  formatEventDate,
  formatEventTime,
  getRelativeSundayLabel,
  groupEventsBySunday,
  formatEventPeriod,
  type MarketEvent,
} from "./calendar";

function makeEvent(overrides: Partial<MarketEvent> & { id: string; event_date: string }): MarketEvent {
  return {
    title: `イベント${overrides.id}`,
    description: null,
    end_date: null,
    start_time: null,
    end_time: null,
    location: null,
    category: "event",
    image_url: null,
    is_highlight: false,
    ...overrides,
  };
}

// 実行環境のタイムゾーンに左右されないよう、基準日は UTC の瞬時刻で書く。
// コメントの JST 表記が、その瞬間に高知で何日の何時かを示す。
describe("toIsoDate", () => {
  it("JST の暦日を YYYY-MM-DD にする", () => {
    // JST 2026-08-17 12:00
    expect(toIsoDate(new Date("2026-08-17T03:00:00Z"))).toBe("2026-08-17");
  });

  it("月日を0埋めする", () => {
    // JST 2026-01-05 09:00
    expect(toIsoDate(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });

  it("JST の深夜0時台が UTC の前日に倒れない", () => {
    // JST 2026-08-17 00:30（UTC ではまだ 08-16 15:30）
    expect(toIsoDate(new Date("2026-08-16T15:30:00Z"))).toBe("2026-08-17");
  });

  it("JST の23時台が翌日に繰り上がらない", () => {
    // JST 2026-08-16 23:30
    expect(toIsoDate(new Date("2026-08-16T14:30:00Z"))).toBe("2026-08-16");
  });
});

describe("getUpcomingSundayIso", () => {
  it("平日なら今週の日曜を返す", () => {
    // JST 2026-08-12（水）12:00
    expect(getUpcomingSundayIso(new Date("2026-08-12T03:00:00Z"))).toBe("2026-08-16");
  });

  it("日曜当日はその日を返す", () => {
    // JST 2026-08-16（日）12:00
    expect(getUpcomingSundayIso(new Date("2026-08-16T03:00:00Z"))).toBe("2026-08-16");
  });

  it("土曜なら翌日を返す", () => {
    // JST 2026-08-15（土）12:00
    expect(getUpcomingSundayIso(new Date("2026-08-15T03:00:00Z"))).toBe("2026-08-16");
  });

  it("月曜の未明でも前日の日曜に戻らない", () => {
    // JST 2026-08-17（月）00:30。UTC ではまだ 08-16（日）なので、
    // サーバーのローカル時刻で判定すると過ぎたばかりの 08-16 を返してしまう。
    expect(getUpcomingSundayIso(new Date("2026-08-16T15:30:00Z"))).toBe("2026-08-23");
  });

  it("月をまたぐ場合も正しい日付になる", () => {
    // JST 2026-08-31（月）12:00
    expect(getUpcomingSundayIso(new Date("2026-08-31T03:00:00Z"))).toBe("2026-09-06");
  });
});

describe("normalizeStatus", () => {
  it("既知のステータスはそのまま通す", () => {
    expect(normalizeStatus("cancelled")).toBe("cancelled");
    expect(normalizeStatus("special")).toBe("special");
    expect(normalizeStatus("closed")).toBe("closed");
  });

  it("想定外の値は open に倒す", () => {
    expect(normalizeStatus("unknown")).toBe("open");
    expect(normalizeStatus(null)).toBe("open");
    expect(normalizeStatus(undefined)).toBe("open");
    expect(normalizeStatus(123)).toBe("open");
  });
});

describe("getStatusPresentation", () => {
  it("中止・臨時休市は警戒色にする", () => {
    expect(getStatusPresentation("cancelled").tone).toBe("alert");
    expect(getStatusPresentation("closed").tone).toBe("alert");
  });

  it("通常開催は目立たせない", () => {
    expect(getStatusPresentation("open").tone).toBe("neutral");
  });

  it("特別開催はアクセント色にする", () => {
    expect(getStatusPresentation("special").tone).toBe("highlight");
  });
});

describe("shouldSurfaceOnMap", () => {
  it("通常開催のときはマップにバーを出さない", () => {
    expect(shouldSurfaceOnMap("open")).toBe(false);
  });

  it("例外のときだけマップにバーを出す", () => {
    expect(shouldSurfaceOnMap("cancelled")).toBe(true);
    expect(shouldSurfaceOnMap("closed")).toBe(true);
    expect(shouldSurfaceOnMap("special")).toBe(true);
  });
});

describe("formatEventDate", () => {
  it("曜日つきの表示にする", () => {
    expect(formatEventDate("2026-08-16")).toBe("8/16（日）");
  });

  it("0埋めを外して表示する", () => {
    expect(formatEventDate("2026-01-05")).toBe("1/5（月）");
  });

  it("壊れた入力はそのまま返す", () => {
    expect(formatEventDate("not-a-date")).toBe("not-a-date");
  });
});

describe("normalizeCategory", () => {
  it("既知の種別はそのまま通す", () => {
    expect(normalizeCategory("vendor")).toBe("vendor");
    expect(normalizeCategory("season")).toBe("season");
    expect(normalizeCategory("notice")).toBe("notice");
  });

  it("想定外の値はイベント扱いにする", () => {
    expect(normalizeCategory("unknown")).toBe("event");
    expect(normalizeCategory(null)).toBe("event");
  });
});

describe("getCategoryPresentation", () => {
  it("4種別すべてにラベルと絵文字がある", () => {
    for (const category of ["vendor", "event", "season", "notice"] as const) {
      const presentation = getCategoryPresentation(category);
      expect(presentation.label).toBeTruthy();
      expect(presentation.emoji).toBeTruthy();
    }
  });
});

describe("getRelativeSundayLabel", () => {
  it("0週先は今週", () => {
    expect(getRelativeSundayLabel(0)).toBe("今週");
  });

  it("1週先は来週", () => {
    expect(getRelativeSundayLabel(1)).toBe("来週");
  });

  it("2週以降はあとN週", () => {
    expect(getRelativeSundayLabel(2)).toBe("あと2週");
    expect(getRelativeSundayLabel(4)).toBe("あと4週");
  });
});

describe("groupEventsBySunday", () => {
  // JST 2026-08-12（水）12:00 を基準にする。今週の日曜は 08-16。
  const now = new Date("2026-08-12T03:00:00Z");

  it("指定した数だけ日曜を返す", () => {
    const sundays = groupEventsBySunday([], [], 4, now);
    expect(sundays.map((s) => s.dateIso)).toEqual([
      "2026-08-16",
      "2026-08-23",
      "2026-08-30",
      "2026-09-06",
    ]);
  });

  it("予定が無い日曜も枠として残す", () => {
    const sundays = groupEventsBySunday([], [], 2, now);
    expect(sundays[0].events).toEqual([]);
    expect(sundays[0].highlight).toBeNull();
  });

  it("イベントを開催日の日曜に振り分ける", () => {
    const events = [
      makeEvent({ id: "a", event_date: "2026-08-16" }),
      makeEvent({ id: "b", event_date: "2026-08-23" }),
    ];
    const sundays = groupEventsBySunday(events, [], 2, now);
    expect(sundays[0].events.map((e) => e.id)).toEqual(["a"]);
    expect(sundays[1].events.map((e) => e.id)).toEqual(["b"]);
  });

  it("日曜以外の日付の予定はその週の日曜に寄せる", () => {
    // 08-15 は土曜なので、08-16（日）のカードに載る
    const events = [makeEvent({ id: "sat", event_date: "2026-08-15" })];
    const sundays = groupEventsBySunday(events, [], 2, now);
    expect(sundays[0].events.map((e) => e.id)).toEqual(["sat"]);
  });

  it("見どころを1件だけ切り出し、残りと重複させない", () => {
    const events = [
      makeEvent({ id: "normal", event_date: "2026-08-16" }),
      makeEvent({ id: "star", event_date: "2026-08-16", is_highlight: true }),
    ];
    const sundays = groupEventsBySunday(events, [], 1, now);
    expect(sundays[0].highlight?.id).toBe("star");
    expect(sundays[0].events.map((e) => e.id)).toEqual(["normal"]);
  });

  it("開始時刻の早い順に並べ、未設定は最後に回す", () => {
    const events = [
      makeEvent({ id: "none", event_date: "2026-08-16" }),
      makeEvent({ id: "late", event_date: "2026-08-16", start_time: "14:00:00" }),
      makeEvent({ id: "early", event_date: "2026-08-16", start_time: "09:00:00" }),
    ];
    const sundays = groupEventsBySunday(events, [], 1, now);
    expect(sundays[0].events.map((e) => e.id)).toEqual(["early", "late", "none"]);
  });

  it("開催ステータスを該当する日曜に結びつける", () => {
    const days = [
      { market_date: "2026-08-23", status: "cancelled" as const, note: "台風のため" },
    ];
    const sundays = groupEventsBySunday([], days, 2, now);
    expect(sundays[0].day).toBeNull();
    expect(sundays[1].day?.status).toBe("cancelled");
  });

  it("連続開催の予定は期間内のすべての日曜に載る", () => {
    const events = [
      makeEvent({ id: "fair", event_date: "2026-08-16", end_date: "2026-09-06" }),
    ];
    const sundays = groupEventsBySunday(events, [], 5, now);
    expect(sundays.map((s) => s.events.length)).toEqual([1, 1, 1, 1, 0]);
  });

  it("連続開催の終了後の日曜には載らない", () => {
    const events = [
      makeEvent({ id: "fair", event_date: "2026-08-16", end_date: "2026-08-23" }),
    ];
    const sundays = groupEventsBySunday(events, [], 3, now);
    expect(sundays.map((s) => s.events.length)).toEqual([1, 1, 0]);
  });

  it("開始日が過去でも終了日が未来なら今週に載る", () => {
    // 08-09（前の日曜）に始まり 08-23 まで続く予定
    const events = [
      makeEvent({ id: "ongoing", event_date: "2026-08-09", end_date: "2026-08-23" }),
    ];
    const sundays = groupEventsBySunday(events, [], 3, now);
    expect(sundays.map((s) => s.events.length)).toEqual([1, 1, 0]);
  });

  it("end_date が開始日より前の壊れたデータは単発として扱う", () => {
    const events = [
      makeEvent({ id: "broken", event_date: "2026-08-16", end_date: "2026-08-01" }),
    ];
    const sundays = groupEventsBySunday(events, [], 3, now);
    expect(sundays.map((s) => s.events.length)).toEqual([1, 0, 0]);
  });

  it("連続開催の見どころは各日曜で見どころのまま扱う", () => {
    const events = [
      makeEvent({
        id: "star",
        event_date: "2026-08-16",
        end_date: "2026-08-23",
        is_highlight: true,
      }),
    ];
    const sundays = groupEventsBySunday(events, [], 2, now);
    expect(sundays[0].highlight?.id).toBe("star");
    expect(sundays[1].highlight?.id).toBe("star");
    expect(sundays[0].events).toEqual([]);
  });

  it("先頭だけが今週になり、相対ラベルが付く", () => {
    const sundays = groupEventsBySunday([], [], 3, now);
    expect(sundays.map((s) => s.isThisWeek)).toEqual([true, false, false]);
    expect(sundays.map((s) => s.relativeLabel)).toEqual(["今週", "来週", "あと2週"]);
  });
});

describe("formatEventPeriod", () => {
  it("単発ならその日だけを返す", () => {
    expect(formatEventPeriod(makeEvent({ id: "a", event_date: "2026-08-16" }))).toBe("8/16（日）");
  });

  it("連続開催なら期間を返す", () => {
    expect(
      formatEventPeriod(
        makeEvent({ id: "a", event_date: "2026-08-16", end_date: "2026-09-06" })
      )
    ).toBe("8/16（日）〜9/6（日）");
  });

  it("終了日が開始日と同じなら単発扱いにする", () => {
    expect(
      formatEventPeriod(
        makeEvent({ id: "a", event_date: "2026-08-16", end_date: "2026-08-16" })
      )
    ).toBe("8/16（日）");
  });
});

describe("formatEventTime", () => {
  it("開始と終了があれば範囲にする", () => {
    expect(formatEventTime("10:00:00", "15:00:00")).toBe("10:00〜15:00");
  });

  it("開始だけなら開始〜にする", () => {
    expect(formatEventTime("10:00:00", null)).toBe("10:00〜");
  });

  it("終了だけなら〜終了にする", () => {
    expect(formatEventTime(null, "15:00:00")).toBe("〜15:00");
  });

  it("どちらも無ければ null", () => {
    expect(formatEventTime(null, null)).toBeNull();
  });
});
