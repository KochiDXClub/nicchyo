"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import NavigationBar from "../components/NavigationBar";
import { loadKotodute, saveKotodute, type KotoduteNote } from "../../lib/kotoduteStorage";
import { useShops } from "../../lib/hooks/useShops";
import { useSearchParams } from "next/navigation";
import { MessageSquarePlus, Sparkles } from "lucide-react";

function formatDate(ts: number) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function extractTarget(tag: string): number | "all" {
  const trimmed = tag.trim().replace(/^#/, "");
  if (!trimmed) return "all";
  if (trimmed.toLowerCase() === "all") return "all";
  const num = Number(trimmed);
  if (!Number.isNaN(num) && num > 0) return num;
  return "all";
}

function findShopName(shops: { id: number; name: string }[], id: number) {
  return shops.find((s) => s.id === id)?.name ?? `#${id}`;
}

export default function KotoduteClient() {
  const { shops } = useShops();
  const shopOptions = useMemo(
    () => shops.map((s) => ({ id: s.id, name: s.name })),
    [shops]
  );
  const searchParams = useSearchParams();
  const prefillTarget = searchParams?.get("shopId") ?? undefined;

  const [notes, setNotes] = useState<KotoduteNote[]>([]);
  const [text, setText] = useState("");
  const [targetTag, setTargetTag] = useState(prefillTarget ? `#${prefillTarget}` : "#all");
  const [placeholder, setPlaceholder] = useState("おすすめや感想をひとこと書いてください");

  useEffect(() => {
    setNotes(loadKotodute());
  }, []);

  useEffect(() => {
    // 時間帯に応じたスマートなプレースホルダーの設定
    const hour = new Date().getHours();

    if (hour >= 6 && hour < 11) {
      setPlaceholder("（例）朝市に来ました！新鮮な野菜がたくさん…");
    } else if (hour >= 11 && hour < 14) {
      setPlaceholder("（例）お昼ご飯を食べました。美味しかったのは…");
    } else if (hour >= 14 && hour < 17) {
      setPlaceholder("（例）おやつの時間です。いも天が…");
    } else if (hour >= 17) {
      setPlaceholder("（例）今日の戦利品はこれ！晩ごはんに…");
    } else {
      setPlaceholder("（例）明日の日曜市が楽しみ！狙っているのは…");
    }
  }, []);

  const target = extractTarget(targetTag);

  const filteredNotes = useMemo(() => {
    return notes.slice().sort((a, b) => b.createdAt - a.createdAt);
  }, [notes]);

  const handleSubmit = () => {
    const body = text.trim();
    if (!body) return;
    const next: KotoduteNote = {
      id: crypto.randomUUID(),
      shopId: target,
      text: body + (targetTag ? ` ${targetTag}` : ""),
      createdAt: Date.now(),
    };
    const updated = [next, ...notes];
    setNotes(updated);
    saveKotodute(updated);
    setText("");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white text-gray-900 pb-28 pt-4">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
        <div className="rounded-2xl border border-amber-100 bg-white/95 px-6 py-5 text-center shadow-sm">
          <p className="text-base font-semibold uppercase tracking-[0.14em] text-amber-700">Kotodute</p>
          <h2 className="mt-1 text-4xl font-bold text-gray-900">ことづて</h2>
          <p className="mt-1 text-xl text-gray-700">日曜市の感想やおすすめを気軽にシェア</p>
        </div>

        <section className="rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-100 via-yellow-50 to-white p-4 shadow-md">
          <div className="flex flex-col items-center gap-3 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-full bg-white text-3xl shadow-inner shadow-amber-200/70 border border-amber-200 flex items-center justify-center">
                ❓
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">campaign</p>
                <p className="text-xl font-bold text-amber-900">３００コメント達成で日曜市フォトスポット作成決定！！</p>
                <p className="text-sm text-amber-800">みんなの声でフォトスポットをつくろう。応援コメント待ってます！</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-2xl rounded-2xl border-2 border-orange-300 bg-white/95 p-5 shadow-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">
            投稿する
          </p>
          <div className="mt-3 flex flex-col gap-4">
            <div className="space-y-2">
              <label className="text-sm text-gray-700">本文</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholder}
              className="w-full rounded-lg border border-orange-100 px-3 py-2 text-base text-gray-800 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 min-h-[80px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-gray-700">投稿先</label>
              <select
                value={targetTag}
                onChange={(e) => setTargetTag(e.target.value)}
              className="w-full rounded-lg border border-orange-100 px-3 py-2 text-base text-gray-800 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              >
                <option value="#all">全体</option>
                <optgroup label="お店">
                  {shopOptions.map((s) => (
                    <option key={s.id} value={`#${s.id}`}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={handleSubmit}
              className="w-full rounded-lg bg-amber-600 px-5 py-3.5 text-base font-semibold text-white shadow-sm shadow-amber-200/70 transition hover:bg-amber-500"
            >
              投稿する
            </button>
          </div>
        </section>

        <section className="rounded-2xl border-2 border-orange-300 bg-white/95 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-700">
                ことづて一覧
              </p>
              <h2 className="text-xl font-bold text-gray-900">全体とお店あてのことづて</h2>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800 border border-amber-100">
              {filteredNotes.length}件
            </span>
          </div>

          {filteredNotes.length === 0 ? (
            <div className="mt-3 rounded-xl border-2 border-dashed border-amber-300 bg-white/80 px-6 py-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <MessageSquarePlus size={32} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-900 flex items-center justify-center gap-2">
                <Sparkles size={20} className="text-yellow-500" />
                一番乗りで投稿しよう！
              </h3>
              <p className="mx-auto max-w-sm text-sm text-gray-600 leading-relaxed">
                まだコメントがありません。
                <br />
                あなたの日曜市体験や、お店への応援メッセージをシェアしてください。
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              {filteredNotes.map((note) => {
                const shopIdNum = typeof note.shopId === "number" && note.shopId > 0 ? note.shopId : null;
                const isAll = shopIdNum === null;
                const label = shopIdNum ? findShopName(shops, shopIdNum) : "日曜市全体";
                const targetHref = shopIdNum ? `/map?shop=${shopIdNum}` : "/map";

                return (
                  <Link
                    key={note.id}
                    href={targetHref}
                    className={`block rounded-xl px-4 py-3 text-base transition ${
                      isAll
                        ? "border border-slate-200 bg-slate-50/70 hover:bg-slate-100"
                        : "border border-amber-100 bg-amber-50/40 hover:bg-amber-100/80"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isAll ? "bg-slate-900 text-white" : "bg-amber-600 text-white"
                          }`}
                        >
                          {isAll ? "#all" : `#${shopIdNum}`}
                        </span>
                        <span className="text-sm text-gray-700">{label}</span>
                      </div>
                      <span className="text-xs text-gray-500">{formatDate(note.createdAt)}</span>
                    </div>
                    <p className="mt-2 text-lg leading-relaxed text-gray-900">{note.text}</p>
                    {!isAll && (
                      <div className="mt-2 text-sm font-semibold text-amber-700 underline">お店のカードを開く</div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <footer className="py-8">
        <div className="mx-auto max-w-4xl px-4 text-center text-[11px] text-gray-600">
          <p className="font-medium">nicchyo ことづて</p>
          <p className="mt-1">宛先を選んで投稿できるシンプルな一言掲示板です。</p>
        </div>
      </footer>
      <NavigationBar />
    </main>
  );
}
