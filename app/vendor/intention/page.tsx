"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, type FormEvent } from "react";
import { Button, CenteredLoading, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import {
  INTENTION_FREQUENCIES,
  INTENTION_FREQUENCY_LABELS,
  INTENTION_MONTHS,
  INTENTION_NOTE_MAX,
  type IntentionBoothCount,
  type IntentionFrequency,
  type IntentionResponse,
  type IntentionSeason,
} from "@/lib/vendor/intention";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; season: IntentionSeason | null; response: IntentionResponse | null; editable: boolean };

type Draft = {
  boothCount: IntentionBoothCount | null;
  frequency: IntentionFrequency | null;
  months: number[];
  note: string;
};

const BOOTH_COUNTS: IntentionBoothCount[] = [1, 2, 3];

/** 2027-01-31 → 2027年1月31日 */
function formatJapaneseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

function draftFrom(response: IntentionResponse | null): Draft {
  return {
    boothCount: response?.boothCount ?? null,
    frequency: response?.frequency ?? null,
    months: response?.preferredMonths ?? [],
    note: response?.note ?? "",
  };
}

/**
 * 出店意向調査。来季の希望（区画数・頻度・出られたい月）を、店舗ごとに答える。
 * 受付期間中は何度でも書き直せる。回答は市役所には店舗名つきでは見えず、集計の一部になる。
 */
export default function VendorIntentionPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<Draft>({ boothCount: null, frequency: null, months: [], note: "" });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vendor/intention", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "読み込めませんでした");
        return res.json() as Promise<{ season: IntentionSeason | null; response: IntentionResponse | null; editable: boolean }>;
      })
      .then((data) => {
        if (cancelled) return;
        setDraft(draftFrom(data.response));
        setState({ status: "ready", ...data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: err instanceof Error ? err.message : "読み込めませんでした" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleMonth = (month: number) =>
    setDraft((prev) => ({
      ...prev,
      months: prev.months.includes(month) ? prev.months.filter((m) => m !== month) : [...prev.months, month],
    }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draft.boothCount === null || draft.frequency === null) {
      setSaveMessage({ tone: "error", text: "区画数と出店の頻度を選んでください" });
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/vendor/intention", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boothCount: draft.boothCount,
          frequency: draft.frequency,
          preferredMonths: draft.months,
          note: draft.note,
        }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; response?: IntentionResponse; season?: IntentionSeason } | null;
      if (!res.ok || !body?.response) {
        setSaveMessage({ tone: "error", text: body?.error ?? "保存できませんでした。もう一度お試しください" });
        return;
      }
      setDraft(draftFrom(body.response));
      setState((prev) =>
        prev.status === "ready" ? { ...prev, response: body.response ?? null } : prev,
      );
      setSaveMessage({ tone: "ok", text: "保存しました" });
    } catch {
      setSaveMessage({ tone: "error", text: "通信できませんでした。電波の良いところでもう一度お試しください" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="来季の出店の希望" />
      <PageContainer className="space-y-6">
        {state.status === "loading" && <CenteredLoading />}

        {state.status === "error" && (
          <p role="alert" className="rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
            {state.message}
          </p>
        )}

        {state.status === "ready" && !state.season && (
          <Surface padding="lg" className="space-y-2">
            <p className="text-base font-bold text-nicchyo-ink">いまは受付をしていません</p>
            <p className="text-sm leading-relaxed text-nicchyo-ink/70">
              来季の希望を集める期間になったら、ここから答えられます。
            </p>
          </Surface>
        )}

        {state.status === "ready" && state.season && (
          <form onSubmit={handleSubmit} className="space-y-6" aria-label={state.season.title}>
            <Surface padding="md" className="space-y-1">
              <p className="text-base font-bold text-nicchyo-ink">{state.season.title}</p>
              <p className="text-sm leading-relaxed text-nicchyo-ink/70">
                {formatJapaneseDate(state.season.closesOn)} まで書き直せます。市役所に伝わるのは、店ごとではなく全体の数だけです。
                ほかの店の答えは見えません。
              </p>
            </Surface>

            <fieldset className="space-y-3">
              <legend className="px-1 text-lg font-bold text-nicchyo-ink">区画の数</legend>
              <div className="grid grid-cols-3 gap-2">
                {BOOTH_COUNTS.map((count) => (
                  <label
                    key={count}
                    className="flex min-h-11 cursor-pointer items-center justify-center rounded-btn bg-nicchyo-base px-3 text-sm font-bold text-nicchyo-ink ring-1 ring-nicchyo-ink/15 has-[:checked]:bg-nicchyo-primary/20 has-[:checked]:ring-2 has-[:checked]:ring-nicchyo-primary"
                  >
                    <input
                      type="radio"
                      name="boothCount"
                      value={count}
                      checked={draft.boothCount === count}
                      onChange={() => setDraft((prev) => ({ ...prev, boothCount: count }))}
                      className="sr-only"
                    />
                    {count}区画
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="px-1 text-lg font-bold text-nicchyo-ink">出店の頻度</legend>
              <div className="space-y-2">
                {INTENTION_FREQUENCIES.map((frequency) => (
                  <label
                    key={frequency}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-btn bg-nicchyo-base px-3 text-sm text-nicchyo-ink ring-1 ring-nicchyo-ink/15 has-[:checked]:ring-2 has-[:checked]:ring-nicchyo-primary"
                  >
                    <input
                      type="radio"
                      name="frequency"
                      value={frequency}
                      checked={draft.frequency === frequency}
                      onChange={() => setDraft((prev) => ({ ...prev, frequency }))}
                    />
                    {INTENTION_FREQUENCY_LABELS[frequency]}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="px-1 text-lg font-bold text-nicchyo-ink">出たい月（選ばなくてもよい）</legend>
              <div className="grid grid-cols-4 gap-2">
                {INTENTION_MONTHS.map((month) => (
                  <label
                    key={month}
                    className="flex min-h-11 cursor-pointer items-center justify-center rounded-btn bg-nicchyo-base px-2 text-sm text-nicchyo-ink ring-1 ring-nicchyo-ink/15 has-[:checked]:bg-nicchyo-primary/20 has-[:checked]:ring-2 has-[:checked]:ring-nicchyo-primary"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={draft.months.includes(month)}
                      onChange={() => toggleMonth(month)}
                    />
                    {month}月
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="intention-note" className="px-1 text-lg font-bold text-nicchyo-ink">
                ひとこと（任意）
              </label>
              <textarea
                id="intention-note"
                value={draft.note}
                maxLength={INTENTION_NOTE_MAX}
                rows={3}
                onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
                className="w-full rounded-btn bg-nicchyo-base p-3 text-sm text-nicchyo-ink ring-1 ring-nicchyo-ink/15"
              />
              <p className="px-1 text-xs text-nicchyo-ink/60">
                {draft.note.length}/{INTENTION_NOTE_MAX}
              </p>
            </div>

            {saveMessage && (
              <p
                role={saveMessage.tone === "error" ? "alert" : "status"}
                className={
                  saveMessage.tone === "error"
                    ? "rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line"
                    : "rounded-btn bg-status-good-bg p-3 text-sm text-status-good-fg ring-1 ring-status-good-line"
                }
              >
                {saveMessage.text}
              </p>
            )}

            <Button type="submit" disabled={saving || !state.editable} className="w-full">
              {saving ? "保存しています…" : state.response ? "書き直して保存する" : "回答を保存する"}
            </Button>
          </form>
        )}
      </PageContainer>
    </PageShell>
  );
}
