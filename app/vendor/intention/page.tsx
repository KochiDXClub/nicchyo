"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, CenteredLoading, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import IntentionPointMap, { type IntentionMapPoint } from "@/components/intention/IntentionPointMap";
import { CHOMES, type ChomeId } from "@/lib/map/chomes";
import { intentionPlaceLabel, type IntentionPlace, type IntentionResponse, type IntentionSeason } from "@/lib/vendor/intention";

type ReadyState = {
  status: "ready";
  season: IntentionSeason | null;
  response: IntentionResponse | null;
  places: IntentionPlace[];
  /** 今出店している場所（回答がまだ無いときの初期選択） */
  currentPlaceId: string | null;
  editable: boolean;
};

type LoadState = { status: "loading" } | { status: "error"; message: string } | ReadyState;

/** 2027-01-31 → 2027年1月31日 */
function formatJapaneseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

/** 場所の丁目（分からなければ null） */
function chomeOfPlace(places: IntentionPlace[], placeId: string | null): ChomeId | null {
  return places.find((place) => place.id === placeId)?.chome ?? null;
}

/**
 * 出店意向調査。来季、出店したい丁目を選ぶ（丁目だけでも回答できる）。
 * 丁目の中の場所は、地図の点か一覧から選べる（任意）。初期は今出店している場所。
 * 受付期間中は何度でも選び直せる。市役所に伝わるのは丁目と場所ごとの件数だけ。
 */
export default function VendorIntentionPage() {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [chome, setChome] = useState<ChomeId | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/vendor/intention", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "読み込めませんでした");
        return res.json() as Promise<Omit<ReadyState, "status">>;
      })
      .then((data) => {
        if (cancelled) return;
        // 回答済みならその丁目・場所。まだなら今出店している場所の丁目と場所を初期選択にする（あとから自由に選び直せる）
        // 回答があれば、その場所（丁目だけの回答なら null のまま）。回答がまだ無いときだけ今の場所にする
        const initialPlaceId = data.response ? data.response.placeId : (data.currentPlaceId ?? null);
        const initialChome = data.response?.chome ?? chomeOfPlace(data.places, initialPlaceId);
        setPlaceId(initialPlaceId);
        setChome(initialChome);
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

  const places = useMemo(() => (state.status === "ready" ? state.places : []), [state]);
  const placesInChome = useMemo(() => places.filter((place) => place.chome === chome), [places, chome]);

  const pickChome = (next: ChomeId) => {
    setChome(next);
    // 選んでいた場所が別の丁目なら、場所は外す（丁目と場所をずらさない）
    if (placeId && chomeOfPlace(places, placeId) !== next) setPlaceId(null);
    setSaveMessage(null);
  };

  const pickPlace = (place: IntentionPlace) => {
    setPlaceId(place.id);
    if (place.chome !== null) setChome(place.chome);
    setSaveMessage(null);
  };

  const mapPoints: IntentionMapPoint[] = places.map((place) => ({
    id: place.id,
    label: intentionPlaceLabel(place),
    chome: place.chome,
    lat: place.lat,
    lng: place.lng,
  }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (chome === null) {
      setSaveMessage({ tone: "error", text: "出店したい丁目を選んでください" });
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch("/api/vendor/intention", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chome, placeId: placeId ?? null }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string; response?: IntentionResponse } | null;
      if (!res.ok || !body?.response) {
        setSaveMessage({ tone: "error", text: body?.error ?? "保存できませんでした。もう一度お試しください" });
        return;
      }
      setChome(body.response.chome);
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
                {formatJapaneseDate(state.season.closesOn)} まで選び直せます。市役所に伝わるのは、丁目と場所ごとの件数だけです。
                ほかの店の答えは見えません。
              </p>
            </Surface>

            <fieldset className="space-y-3">
              <legend className="px-1 text-lg font-bold text-nicchyo-ink">1. 出店したい丁目</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {CHOMES.map((item) => (
                  <label
                    key={item.id}
                    className="flex min-h-11 cursor-pointer items-center justify-center rounded-btn bg-nicchyo-base px-2 text-sm font-bold text-nicchyo-ink ring-1 ring-nicchyo-ink/15 has-[:checked]:ring-2 has-[:checked]:ring-nicchyo-primary"
                  >
                    <input
                      type="radio"
                      name="chome"
                      value={item.id}
                      className="sr-only"
                      checked={chome === item.id}
                      onChange={() => pickChome(item.id)}
                    />
                    {item.shortName}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="px-1 text-lg font-bold text-nicchyo-ink">2. 場所（任意）</legend>
              <p className="px-1 text-sm text-nicchyo-ink/70">
                地図の点か一覧から、{chome === null ? "丁目を選ぶと場所を選べます" : `${CHOMES.find((item) => item.id === chome)?.shortName ?? ""}の場所を選べます`}。
                場所を選ばずに丁目だけで答えても構いません。
              </p>
              <IntentionPointMap
                points={mapPoints}
                selectedId={placeId}
                activeChome={chome}
                onSelect={(point) => {
                  const place = places.find((item) => item.id === point.id);
                  if (place) pickPlace(place);
                }}
                label="出店場所の地図（点を押すと場所を選べます）"
              />
              {chome !== null && placesInChome.length === 0 && (
                <p className="text-sm text-nicchyo-ink/70">この丁目の場所は、まだ登録されていません。丁目だけで答えてください。</p>
              )}
              {chome !== null && placesInChome.length > 0 && (
                <div className="space-y-2">
                  {placesInChome.map((place) => (
                    <label
                      key={place.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-btn bg-nicchyo-base px-3 text-sm text-nicchyo-ink ring-1 ring-nicchyo-ink/15 has-[:checked]:ring-2 has-[:checked]:ring-nicchyo-primary"
                    >
                      <input
                        type="radio"
                        name="place"
                        value={place.id}
                        checked={placeId === place.id}
                        onChange={() => pickPlace(place)}
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

            <Button type="submit" disabled={saving || !state.editable || chome === null} className="w-full">
              {saving ? "保存しています…" : state.response ? "選び直して保存する" : "回答を保存する"}
            </Button>
          </form>
        )}
      </PageContainer>
    </PageShell>
  );
}
