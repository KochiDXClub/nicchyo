"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Surface } from "@/components/ui";
import { showToast } from "@/lib/admin/toast";
import {
  ANNOUNCEMENT_BODY_EN_MAX,
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_EN_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  announcementStatus,
  type Announcement,
  type AnnouncementStatus,
  type TranslationStatus,
} from "@/lib/announcements/schema";
import { TRANSLATION_STATUS_LABEL, englishState } from "@/lib/announcements/translationState";
import { formatAnnouncementDate, fromJstInputValue, toJstInputValue } from "@/lib/announcements/format";

const fieldClass =
  "w-full rounded-btn border border-line bg-white px-3 py-2 text-sm text-nicchyo-ink focus:border-amber-400 focus:outline-none";

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  active: "公開中",
  scheduled: "公開前",
  ended: "終了",
  hidden: "非公開",
};
const STATUS_VARIANT: Record<AnnouncementStatus, "amber" | "info" | "neutral" | "caution"> = {
  active: "amber",
  scheduled: "info",
  ended: "neutral",
  hidden: "caution",
};

type FormState = {
  title: string;
  body: string;
  important: boolean;
  published: boolean;
  /** datetime-local（日本時間）。空なら今すぐ */
  startsAt: string;
  /** datetime-local（日本時間）。空なら終了日なし */
  endsAt: string;
  /** 英語版。タイトルと本文は両方入れるか、両方空 */
  titleEn: string;
  bodyEn: string;
  translationStatus: TranslationStatus | null;
};

const EMPTY_FORM: FormState = {
  title: "",
  body: "",
  important: false,
  published: true,
  startsAt: "",
  endsAt: "",
  titleEn: "",
  bodyEn: "",
  translationStatus: null,
};

type SourceText = { title: string; body: string };

/** 「訳したときの日本語」が分からない（下書き保存した古い英語版）ことを表す。どの日本語とも一致しないので、必ず stale になる */
const STALE_SNAPSHOT: SourceText = { title: "\u0000", body: "\u0000" };

function toForm(a: Announcement): FormState {
  return {
    title: a.title,
    body: a.body,
    important: a.important,
    published: a.published,
    startsAt: toJstInputValue(a.startsAt),
    endsAt: toJstInputValue(a.endsAt),
    titleEn: a.titleEn ?? "",
    bodyEn: a.bodyEn ?? "",
    translationStatus: a.translationStatus,
  };
}

function toPayload(form: FormState) {
  return {
    title: form.title,
    body: form.body,
    important: form.important,
    published: form.published,
    startsAt: fromJstInputValue(form.startsAt),
    endsAt: fromJstInputValue(form.endsAt),
    titleEn: form.titleEn,
    bodyEn: form.bodyEn,
    translationStatus: form.titleEn.trim() ? form.translationStatus ?? "reviewed" : null,
  };
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? fallback;
}

/** 公開期間の表示。「10月12日から」「10月12日〜11月3日」 */
function periodLabel(a: Announcement): string {
  const from = formatAnnouncementDate(a.startsAt);
  return a.endsAt ? `${from}〜${formatAnnouncementDate(a.endsAt)}` : `${from}から`;
}

/**
 * サイト内のお知らせ（来訪者向け）。投稿すると、地図ページの上部のバナーと /news に、公開期間のあいだ出る。
 * メールと違い、読みに来た人全員に見える。重要にすると、バナーで目立たせる。
 */
export function SiteAnnouncementSection({
  apiBase = "/api/admin",
}: {
  /** 読み書きする API の入口。高知市のページでは "/api/city" */
  apiBase?: string;
}) {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** 編集中のお知らせの ID。null なら新しく投稿する */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  /** 英語版を作った（または保存済みを読み込んだ）時点の日本語。あとで日本語を直したかの判定に使う */
  const [translatedFrom, setTranslatedFrom] = useState<SourceText | null>(null);
  /** 編集の切り替え（別のお知らせを開く・やめる）のたびに進める。翻訳の結果が、別の編集に紛れ込むのを防ぐ */
  const sessionRef = useRef(0);

  const load = useCallback(async () => {
    const res = await fetch(`${apiBase}/announcements`);
    if (!res.ok) {
      showToast.error(await readError(res, "お知らせを読み込めませんでした"));
      setAnnouncements([]);
      return;
    }
    setAnnouncements(((await res.json()) as { announcements: Announcement[] }).announcements);
  }, [apiBase]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const startEdit = (a: Announcement) => {
    sessionRef.current += 1;
    setTranslating(false);
    setEditingId(a.id);
    setForm(toForm(a));
    // 日本語を直したまま下書き保存した英語版（stale）は、読み込み直しても「日本語と合っていない」ままにする
    setTranslatedFrom(a.translationStatus === "stale" ? STALE_SNAPSHOT : { title: a.title, body: a.body });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    sessionRef.current += 1;
    setTranslating(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setTranslatedFrom(null);
  };

  const jaReady = form.title.trim() !== "" && form.body.trim() !== "";
  const english = englishState({ title: form.title, body: form.body, titleEn: form.titleEn, bodyEn: form.bodyEn, translatedFrom });

  /** 日本語のタイトル・本文を英語にする（サーバーで AI を呼ぶ）。結果は下書きとして英語欄に入れるだけで、保存はしない */
  const translate = async () => {
    if (!jaReady) {
      showToast.error("日本語のタイトルと本文を入れてから翻訳してください");
      return;
    }
    if (english !== "none" && form.translationStatus === "reviewed" && !window.confirm("手直しした英語版は、新しい翻訳で置き換わります。よろしいですか？")) return;
    const session = sessionRef.current;
    setTranslating(true);
    try {
      const res = await fetch("/api/admin/announcements/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, body: form.body }),
      });
      if (!res.ok) throw new Error(await readError(res, "翻訳できませんでした"));
      const data = (await res.json()) as { titleEn: string; bodyEn: string };
      // 翻訳中に別のお知らせを開いた・編集をやめたときは、結果を捨てる（別の編集に英語が入らないように）
      if (session !== sessionRef.current) return;
      setForm((prev) => ({ ...prev, titleEn: data.titleEn, bodyEn: data.bodyEn, translationStatus: "auto" }));
      setTranslatedFrom({ title: form.title, body: form.body });
      showToast.success("英語に翻訳しました。内容を確認してください");
    } catch (e) {
      if (session === sessionRef.current) showToast.error(e instanceof Error ? e.message : "翻訳できませんでした");
    } finally {
      // 別の編集に切り替わっていたら、その編集の状態（translating）は触らない
      if (session === sessionRef.current) setTranslating(false);
    }
  };

  /** 日本語を直したあとの英語版を、運営が確認して「日本語に合っている」とする */
  const confirmEnglish = () => {
    setTranslatedFrom({ title: form.title, body: form.body });
    setForm((prev) => ({ ...prev, translationStatus: "reviewed" }));
  };

  const editEnglish = (key: "titleEn" | "bodyEn", value: string) =>
    setForm((prev) => ({ ...prev, [key]: value, translationStatus: "reviewed" }));

  const clearEnglish = () => {
    if ((form.titleEn || form.bodyEn) && !window.confirm("英語版を消して、日本語だけのお知らせにします。よろしいですか？")) return;
    setForm((prev) => ({ ...prev, titleEn: "", bodyEn: "", translationStatus: null }));
    setTranslatedFrom(null);
  };

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      showToast.error("タイトルと本文を入れてください");
      return;
    }
    if (form.startsAt && !fromJstInputValue(form.startsAt)) {
      showToast.error("公開開始の日時が正しくありません");
      return;
    }
    if (form.endsAt && !fromJstInputValue(form.endsAt)) {
      showToast.error("公開終了の日時が正しくありません");
      return;
    }
    if ((form.titleEn.trim() === "") !== (form.bodyEn.trim() === "")) {
      showToast.error("英語のタイトルと本文は、両方入れるか両方空にしてください");
      return;
    }
    // 公開するときは、英語の来訪者にどう見えるかを確かめてもらう（英語が無い・日本語を直したのに古いまま）
    if (form.published) {
      if (english === "none" && !window.confirm("英語版がありません。英語で見ている来訪者には日本語のまま表示されます。このまま公開しますか？")) return;
      if (english === "stale" && !window.confirm("日本語を直したあと、英語版を更新していません。古い英語のまま公開しますか？\n（キャンセルして、「もう一度翻訳」で作り直せます）")) return;
    }
    setSaving(true);
    try {
      // 日本語の変更後は古い英語版の状態も保存する。
      const payload = { ...toPayload(form), ...(english === "stale" ? { translationStatus: "stale" as const } : {}) };
      const res = await fetch(editingId ? `${apiBase}/announcements/${editingId}` : `${apiBase}/announcements`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await readError(res, "保存できませんでした"));
      showToast.success(editingId ? "お知らせを更新しました" : form.published ? (form.titleEn.trim() ? "日本語と英語で投稿しました" : "お知らせを投稿しました") : "下書きとして保存しました");
      reset();
      await load();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "保存できませんでした");
    } finally {
      setSaving(false);
    }
  };

  /** 公開・非公開の切り替え（ほかの項目はそのまま送る） */
  const togglePublished = async (a: Announcement) => {
    const res = await fetch(`${apiBase}/announcements/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...toPayload(toForm(a)), published: !a.published }),
    });
    if (!res.ok) {
      showToast.error(await readError(res, "切り替えられませんでした"));
      return;
    }
    showToast.success(a.published ? "非公開にしました" : "公開しました");
    await load();
  };

  const remove = async (a: Announcement) => {
    if (!window.confirm(`「${a.title}」を削除します。元に戻せません。よろしいですか？`)) return;
    const res = await fetch(`${apiBase}/announcements/${a.id}`, { method: "DELETE" });
    if (!res.ok) {
      showToast.error(await readError(res, "削除できませんでした"));
      return;
    }
    if (editingId === a.id) reset();
    showToast.success("削除しました");
    await load();
  };

  return (
    <Surface>
      <h2 className="text-lg font-bold text-nicchyo-ink">サイト内のお知らせ</h2>
      <p className="mt-1 text-xs text-nicchyo-ink/55">
        公開期間のあいだ、地図ページの上部のバナーと「お知らせ」ページ（/news）に出ます。来訪者の誰にでも見えます。
      </p>

      <div className="mt-4 rounded-btn bg-amber-50/60 p-3 text-xs text-nicchyo-ink/70">
        {editingId ? "お知らせを編集しています。" : "新しいお知らせを投稿します。"}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="annJaHeading" className="rounded-btn border border-line p-3">
          <h3 id="annJaHeading" className="flex items-center gap-2 text-sm font-bold text-nicchyo-ink">
            <Badge variant="neutral">1</Badge>日本語で書く
          </h3>
          <label htmlFor="annTitle" className="mb-2 mt-3 block text-sm font-medium text-nicchyo-ink">
            タイトル
          </label>
          <input
            id="annTitle"
            type="text"
            lang="ja"
            value={form.title}
            maxLength={ANNOUNCEMENT_TITLE_MAX}
            onChange={(e) => set("title", e.target.value)}
            placeholder="例：10月19日の日曜市は雨天のため中止します"
            className={fieldClass}
          />
          <label htmlFor="annBody" className="mb-2 mt-4 block text-sm font-medium text-nicchyo-ink">
            本文
          </label>
          <textarea
            id="annBody"
            lang="ja"
            value={form.body}
            maxLength={ANNOUNCEMENT_BODY_MAX}
            onChange={(e) => set("body", e.target.value)}
            rows={8}
            className={fieldClass}
          />
          <p className="mt-1 text-right text-[11px] text-nicchyo-ink/40">
            {form.body.length} / {ANNOUNCEMENT_BODY_MAX}
          </p>
        </section>

        <section aria-labelledby="annEnHeading" className="rounded-btn border border-line p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="annEnHeading" className="flex items-center gap-2 text-sm font-bold text-nicchyo-ink">
              <Badge variant="neutral">2</Badge>英語版（AI翻訳 → 確認）
            </h3>
            {english !== "none" && form.translationStatus && (
              <Badge variant={form.translationStatus === "auto" ? "info" : form.translationStatus === "stale" ? "caution" : "amber"}>{TRANSLATION_STATUS_LABEL[form.translationStatus]}</Badge>
            )}
          </div>

          {english === "none" && !translating ? (
            <div className="mt-3 rounded-btn bg-amber-50/60 p-3 text-xs leading-relaxed text-nicchyo-ink/70">
              <p>日本語を書いたら、英語に翻訳できます。翻訳は下書きとして出るので、公開する前に内容を確かめて、直したいところは直せます。</p>
              <p className="mt-1">英語版を作らずに投稿すると、英語で見ている来訪者にも日本語のまま表示されます。</p>
              <Button className="mt-3" variant="secondary" size="sm" onClick={() => void translate()} disabled={!jaReady}>
                AIで英語に翻訳する
              </Button>
              {!jaReady && <p className="mt-2 text-[11px] text-nicchyo-ink/55">日本語のタイトルと本文を入れると押せます。</p>}
            </div>
          ) : translating && english === "none" ? (
            <p role="status" className="mt-3 rounded-btn bg-amber-50/60 p-3 text-sm text-nicchyo-ink/70">
              英語に翻訳しています...（10秒ほどかかります）
            </p>
          ) : (
            <>
              {english === "stale" && (
                <div role="alert" className="mt-3 rounded-btn bg-rose-50 p-3 text-xs leading-relaxed text-rose-700">
                  日本語を変更しました。英語版は変更前の内容のままです。「もう一度翻訳」で作り直すか、英語を直して「英語版は日本語に合っています」を押してください。
                  <Button className="mt-2" variant="quiet" size="sm" onClick={confirmEnglish} disabled={translating}>
                    英語版は日本語に合っています
                  </Button>
                </div>
              )}
              {english === "fresh" && form.translationStatus === "auto" && (
                <p className="mt-3 rounded-btn bg-info-bg p-3 text-xs leading-relaxed text-info-fg">
                  AIが訳した下書きです。日時・数字・場所が日本語と合っているかを確かめてから公開してください。
                </p>
              )}
              <label htmlFor="annTitleEn" className="mb-2 mt-3 block text-sm font-medium text-nicchyo-ink">
                Title
              </label>
              <input
                id="annTitleEn"
                type="text"
                lang="en"
                value={form.titleEn}
                maxLength={ANNOUNCEMENT_TITLE_EN_MAX}
                onChange={(e) => editEnglish("titleEn", e.target.value)}
                disabled={translating}
                className={fieldClass}
              />
              <label htmlFor="annBodyEn" className="mb-2 mt-4 block text-sm font-medium text-nicchyo-ink">
                Body
              </label>
              <textarea
                id="annBodyEn"
                lang="en"
                value={form.bodyEn}
                maxLength={ANNOUNCEMENT_BODY_EN_MAX}
                onChange={(e) => editEnglish("bodyEn", e.target.value)}
                disabled={translating}
                rows={8}
                className={fieldClass}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => void translate()} disabled={translating || !jaReady}>
                    {translating ? "翻訳しています..." : "もう一度翻訳"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearEnglish} disabled={translating}>
                    英語版を使わない
                  </Button>
                </div>
                <p className="text-[11px] text-nicchyo-ink/40">
                  {form.bodyEn.length} / {ANNOUNCEMENT_BODY_EN_MAX}
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="annStarts" className="mb-2 block text-sm font-medium text-nicchyo-ink">
            公開開始（日本時間）
          </label>
          <input id="annStarts" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className={fieldClass} />
          <p className="mt-1 text-[11px] text-nicchyo-ink/55">空なら、保存した時点からすぐ公開します。</p>
        </div>
        <div>
          <label htmlFor="annEnds" className="mb-2 block text-sm font-medium text-nicchyo-ink">
            公開終了（日本時間）
          </label>
          <input id="annEnds" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} className={fieldClass} />
          <p className="mt-1 text-[11px] text-nicchyo-ink/55">空なら、自分で非公開にするまで出し続けます。</p>
        </div>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-nicchyo-ink">
        <input type="checkbox" checked={form.important} onChange={(e) => set("important", e.target.checked)} />
        重要なお知らせ（開催中止など。バナーを目立たせ、一覧の先頭に出します）
      </label>
      <label className="mt-2 flex items-center gap-2 text-sm text-nicchyo-ink">
        <input type="checkbox" checked={form.published} onChange={(e) => set("published", e.target.checked)} />
        公開する（外すと下書きになり、来訪者には出ません）
      </label>

      <p className="mt-4 text-xs text-nicchyo-ink/55">
        {english === "none" ? "公開される言語：日本語のみ（英語の来訪者にも日本語で表示されます）" : "公開される言語：日本語 + 英語（来訪者の言語に合わせて切り替わります）"}
      </p>
      <div className="mt-2 flex justify-end gap-2">
        {editingId && (
          <Button variant="ghost" onClick={reset} disabled={saving}>
            編集をやめる
          </Button>
        )}
        <Button onClick={() => void submit()} disabled={saving || translating}>
          {saving ? "保存しています..." : editingId ? "更新する" : form.published ? (english === "none" ? "日本語のみで投稿する" : "日本語と英語で投稿する") : "下書きを保存"}
        </Button>
      </div>

      <h3 className="mt-8 text-sm font-bold text-nicchyo-ink">投稿したお知らせ</h3>
      {announcements === null ? (
        <p className="mt-2 text-sm text-nicchyo-ink/55">読み込み中...</p>
      ) : announcements.length === 0 ? (
        <p className="mt-2 text-sm text-nicchyo-ink/55">まだありません</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {announcements.map((a) => {
            const status = announcementStatus(a);
            return (
              <li key={a.id} className="py-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-nicchyo-ink">
                  <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                  {a.important && <Badge variant="caution">重要</Badge>}
                  {a.titleEn ? <Badge variant="neutral">JA + EN</Badge> : <Badge variant="neutral">JAのみ</Badge>}
                  {a.title}
                </p>
                <p className="mt-0.5 text-xs text-nicchyo-ink/55">{periodLabel(a)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(a)}>
                    編集
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void togglePublished(a)}>
                    {a.published ? "非公開にする" : "公開する"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(a)}>
                    削除
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Surface>
  );
}
