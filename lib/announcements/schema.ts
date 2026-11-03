/**
 * サイト内のお知らせ（site_announcements）の型・入力の検証・公開中かの判定。
 * 管理画面の投稿 API と、来訪者向けの取得が同じ決まりを使う。
 */

export const ANNOUNCEMENT_TITLE_MAX = 80;
export const ANNOUNCEMENT_BODY_MAX = 2000;
/** 英語は日本語より長くなりやすいので、少し余裕を持たせる（DB の check と同じ） */
export const ANNOUNCEMENT_TITLE_EN_MAX = 240;
export const ANNOUNCEMENT_BODY_EN_MAX = 8000;

/**
 * 英語版の状態。auto = AI 訳のまま、reviewed = 運営が確認・手直し済み、
 * stale = 日本語を直したあとで英語を更新していない（下書き保存しても、開き直したとき警告を出すための印）。英語版なしは null
 */
export type TranslationStatus = "auto" | "reviewed" | "stale";

export type Announcement = {
  id: string;
  title: string;
  body: string;
  important: boolean;
  published: boolean;
  startsAt: string;
  /** null なら終了日なし */
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** 英語版（タイトルと本文は両方あるか、両方ない） */
  titleEn: string | null;
  bodyEn: string | null;
  translationStatus: TranslationStatus | null;
};

/**
 * 来訪者に見せる分（下書きかどうか・更新日時は持たない）。
 * title / body は、来訪者の言語に合わせた文面。`lang` はその文面の言語（英語版が無ければ日本語のまま）
 */
export type PublicAnnouncement = Pick<Announcement, "id" | "title" | "body" | "important" | "startsAt" | "endsAt"> & {
  lang: "ja" | "en";
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  important: boolean;
  published: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  title_en?: string | null;
  body_en?: string | null;
  translation_status?: TranslationStatus | null;
};

export function toAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    important: row.important,
    published: row.published,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    titleEn: row.title_en ?? null,
    bodyEn: row.body_en ?? null,
    translationStatus: row.translation_status ?? null,
  };
}

/** 英語の来訪者に出す文面。英語版が（タイトルも本文も）そろっていなければ日本語のまま */
export function localizeAnnouncement(
  a: Pick<Announcement, "title" | "body" | "titleEn" | "bodyEn">,
  locale: string
): { title: string; body: string; lang: "ja" | "en" } {
  if (locale === "en" && a.titleEn && a.bodyEn) return { title: a.titleEn, body: a.bodyEn, lang: "en" };
  return { title: a.title, body: a.body, lang: "ja" };
}

/** 公開中か（公開にしてあって、公開期間の中） */
export function isAnnouncementActive(
  a: Pick<Announcement, "published" | "startsAt" | "endsAt">,
  now: Date = new Date()
): boolean {
  if (!a.published) return false;
  const t = now.getTime();
  if (new Date(a.startsAt).getTime() > t) return false;
  if (a.endsAt !== null && new Date(a.endsAt).getTime() <= t) return false;
  return true;
}

/** 状態の表示用。公開前（予約）／公開中／終了／非公開 */
export type AnnouncementStatus = "scheduled" | "active" | "ended" | "hidden";

export function announcementStatus(
  a: Pick<Announcement, "published" | "startsAt" | "endsAt">,
  now: Date = new Date()
): AnnouncementStatus {
  if (!a.published) return "hidden";
  const t = now.getTime();
  if (new Date(a.startsAt).getTime() > t) return "scheduled";
  if (a.endsAt !== null && new Date(a.endsAt).getTime() <= t) return "ended";
  return "active";
}

/** 重要なものを先に、その中は新しい順（開始日時の降順） */
export function sortAnnouncements<T extends Pick<Announcement, "important" | "startsAt">>(list: readonly T[]): T[] {
  return [...list].sort(
    (a, b) => Number(b.important) - Number(a.important) || new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
  );
}

export type AnnouncementInput = {
  title: string;
  body: string;
  important: boolean;
  published: boolean;
  /** ISO 8601 */
  startsAt: string;
  endsAt: string | null;
  titleEn: string | null;
  bodyEn: string | null;
  translationStatus: TranslationStatus | null;
};

export type AnnouncementParseResult = { ok: true; value: AnnouncementInput } | { ok: false; error: string };

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/**
 * 投稿・更新の入力を検証する。startsAt が無ければ今（すぐ公開）、endsAt が無ければ終了日なし。
 * 更新でも全項目を受け取る（公開の切り替えも、画面が全項目を送る）。
 */
export function parseAnnouncementInput(body: unknown, now: Date = new Date()): AnnouncementParseResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "リクエストの形が正しくありません" };
  const record = body as Record<string, unknown>;

  const title = typeof record.title === "string" ? record.title.trim() : "";
  if (title.length < 1 || title.length > ANNOUNCEMENT_TITLE_MAX) {
    return { ok: false, error: `タイトルは1〜${ANNOUNCEMENT_TITLE_MAX}文字で入力してください` };
  }
  const text = typeof record.body === "string" ? record.body.trim() : "";
  if (text.length < 1 || text.length > ANNOUNCEMENT_BODY_MAX) {
    return { ok: false, error: `本文は1〜${ANNOUNCEMENT_BODY_MAX}文字で入力してください` };
  }
  if (record.important !== undefined && typeof record.important !== "boolean") {
    return { ok: false, error: "重要の指定が正しくありません" };
  }
  if (record.published !== undefined && typeof record.published !== "boolean") {
    return { ok: false, error: "公開の指定が正しくありません" };
  }

  let startsAt = now.toISOString();
  if (record.startsAt !== undefined && record.startsAt !== null && record.startsAt !== "") {
    const parsed = parseDate(record.startsAt);
    if (!parsed) return { ok: false, error: "公開開始の日時が正しくありません" };
    startsAt = parsed;
  }
  let endsAt: string | null = null;
  if (record.endsAt !== undefined && record.endsAt !== null && record.endsAt !== "") {
    endsAt = parseDate(record.endsAt);
    if (!endsAt) return { ok: false, error: "公開終了の日時が正しくありません" };
  }
  if (endsAt !== null && new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    return { ok: false, error: "公開終了は、公開開始より後にしてください" };
  }

  // 英語版: タイトルと本文は両方入れるか、両方空にする（片方だけだと英語の来訪者に中途半端に出るため）
  const titleEn = typeof record.titleEn === "string" ? record.titleEn.trim() : "";
  const bodyEn = typeof record.bodyEn === "string" ? record.bodyEn.trim() : "";
  if (titleEn.length > ANNOUNCEMENT_TITLE_EN_MAX) {
    return { ok: false, error: `英語のタイトルは${ANNOUNCEMENT_TITLE_EN_MAX}文字以内にしてください` };
  }
  if (bodyEn.length > ANNOUNCEMENT_BODY_EN_MAX) {
    return { ok: false, error: `英語の本文は${ANNOUNCEMENT_BODY_EN_MAX}文字以内にしてください` };
  }
  if ((titleEn === "") !== (bodyEn === "")) {
    return { ok: false, error: "英語のタイトルと本文は、両方入れるか両方空にしてください" };
  }
  const hasEnglish = titleEn !== "";
  if (
    record.translationStatus !== undefined &&
    record.translationStatus !== null &&
    record.translationStatus !== "auto" &&
    record.translationStatus !== "reviewed" &&
    record.translationStatus !== "stale"
  ) {
    return { ok: false, error: "翻訳の状態の指定が正しくありません" };
  }

  return {
    ok: true,
    value: {
      titleEn: hasEnglish ? titleEn : null,
      bodyEn: hasEnglish ? bodyEn : null,
      translationStatus: hasEnglish ? (record.translationStatus === "auto" || record.translationStatus === "stale" ? record.translationStatus : "reviewed") : null,
      title,
      body: text,
      important: record.important === true,
      published: record.published !== false,
      startsAt,
      endsAt,
    },
  };
}
