"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Surface } from "@/components/ui";
import { showToast } from "@/lib/admin/toast";
import {
  ANNOUNCEMENT_BODY_MAX,
  ANNOUNCEMENT_TITLE_MAX,
  announcementStatus,
  type Announcement,
  type AnnouncementStatus,
} from "@/lib/announcements/schema";
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
};

const EMPTY_FORM: FormState = { title: "", body: "", important: false, published: true, startsAt: "", endsAt: "" };

function toForm(a: Announcement): FormState {
  return {
    title: a.title,
    body: a.body,
    important: a.important,
    published: a.published,
    startsAt: toJstInputValue(a.startsAt),
    endsAt: toJstInputValue(a.endsAt),
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
export function SiteAnnouncementSection() {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  /** 編集中のお知らせの ID。null なら新しく投稿する */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/announcements");
    if (!res.ok) {
      showToast.error(await readError(res, "お知らせを読み込めませんでした"));
      setAnnouncements([]);
      return;
    }
    setAnnouncements(((await res.json()) as { announcements: Announcement[] }).announcements);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm(toForm(a));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
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
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/admin/announcements/${editingId}` : "/api/admin/announcements", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      if (!res.ok) throw new Error(await readError(res, "保存できませんでした"));
      showToast.success(editingId ? "お知らせを更新しました" : form.published ? "お知らせを投稿しました" : "下書きとして保存しました");
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
    const res = await fetch(`/api/admin/announcements/${a.id}`, {
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
    const res = await fetch(`/api/admin/announcements/${a.id}`, { method: "DELETE" });
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

      <div className="mt-4">
        <label htmlFor="annTitle" className="mb-2 block text-sm font-medium text-nicchyo-ink">
          タイトル
        </label>
        <input
          id="annTitle"
          type="text"
          value={form.title}
          maxLength={ANNOUNCEMENT_TITLE_MAX}
          onChange={(e) => set("title", e.target.value)}
          placeholder="例：10月19日の日曜市は雨天のため中止します"
          className={fieldClass}
        />
      </div>
      <div className="mt-4">
        <label htmlFor="annBody" className="mb-2 block text-sm font-medium text-nicchyo-ink">
          本文
        </label>
        <textarea
          id="annBody"
          value={form.body}
          maxLength={ANNOUNCEMENT_BODY_MAX}
          onChange={(e) => set("body", e.target.value)}
          rows={6}
          className={fieldClass}
        />
        <p className="mt-1 text-right text-[11px] text-nicchyo-ink/40">
          {form.body.length} / {ANNOUNCEMENT_BODY_MAX}
        </p>
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

      <div className="mt-4 flex justify-end gap-2">
        {editingId && (
          <Button variant="ghost" onClick={reset} disabled={saving}>
            編集をやめる
          </Button>
        )}
        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "保存しています..." : editingId ? "更新する" : form.published ? "投稿する" : "下書きを保存"}
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
