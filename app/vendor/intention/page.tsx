"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, type FormEvent } from "react";
import { Button, CenteredLoading, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import { intentionPlaceLabel, type IntentionPlace, type IntentionResponse, type IntentionSeason } from "@/lib/vendor/intention";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      season: IntentionSeason | null;
      response: IntentionResponse | null;
      places: IntentionPlace[];
      /** 今出店している場所（回答がまだ無いときの初期選択） */
      currentPlaceId: string | null;
      editable: boolean;
    };

/** 2027-01-31 → 2027年1月31日 */
function formatJapaneseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

/**
 * 出店意向調査。来季、出店したい場所を1つ選ぶ。
 * 受付期間中は何度でも選び直せる。市役所に伝わるのは場所ごとの件数だけで、店ごとの回答は見えない。
 */
export default function VendorIntentionPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vendor/intention", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "読み込めませんでした");
        return res.json() as Promise<Omit<Extract<LoadState, { status: "ready" }>, "status">>;
      })
      .then((data) => {
        if (cancelled) return;
        // 回答済みならその場所、まだなら今出店している場所を初期選択にする。そこから自由に選び直せる
        setPlaceId(data.response?.placeId ?? data.currentPlaceId ?? null);
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (placeId === null) {
      setSaveMessage({ tone: "error", text: "出店したい場所を選んでください" });
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/vendor/intention", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; response?: IntentionResponse } | null;
      if (!res.ok || !body?.response) {
        setSaveMessage({ tone: "error", text: body?.error ?? "保存できませんでした。もう一度お試しください" });
        return;
      }
      setPlaceId(body.response.placeId);
      setState((prev) => (prev.status === "ready" ? { ...prev, response: body.response ?? null } : prev));
      setSaveMessage({ tone: "ok", text: "保存しました" });
    } catch {
      setSaveMessage({ tone: "error", text: "通信できませんでした。電波の良いところでもう一度お試しください" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell bottomNav={false}>
      <PageTitle title="出店したい場所" />
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
              来季、出店したい場所を聞く期間になったら、ここから答えられます。
            </p>
          </Surface>
        )}

        {state.status === "ready" && state.season && (
          <form onSubmit={handleSubmit} className="space-y-6" aria-label={state.season.title}>
            <Surface padding="md" className="space-y-1">
              <p className="text-base font-bold text-nicchyo-ink">{state.season.title}</p>
              <p className="text-sm leading-relaxed text-nicchyo-ink/70">
                {formatJapaneseDate(state.season.closesOn)} まで選び直せます。市役所に伝わるのは、場所ごとの件数だけです。
                ほかの店の答えは見えません。
              </p>
            </Surface>

            <fieldset className="space-y-3">
              <legend className="px-1 text-lg font-bold text-nicchyo-ink">出店したい場所</legend>
              {state.places.length === 0 ? (
                <p className="text-sm text-nicchyo-ink/70">選べる場所がまだありません。</p>
              ) : (
                <div className="space-y-2">
                  {state.places.map((place) => (
                    <label
                      key={place.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-btn bg-nicchyo-base px-3 text-sm text-nicchyo-ink ring-1 ring-nicchyo-ink/15 has-[:checked]:ring-2 has-[:checked]:ring-nicchyo-primary"
                    >
                      <input
                        type="radio"
                        name="place"
                        value={place.id}
                        checked={placeId === place.id}
                        onChange={() => setPlaceId(place.id)}
                      />
                      {intentionPlaceLabel(place)}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

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

            <Button type="submit" disabled={saving || !state.editable || state.places.length === 0} className="w-full">
              {saving ? "保存しています…" : state.response ? "選び直して保存する" : "回答を保存する"}
            </Button>
          </form>
        )}
      </PageContainer>
    </PageShell>
  );
}
