"use client";

/**
 * 現場で、住所録（2024年版）に無い店舗を新しく登録する。
 * 店名（とカテゴリ）だけで店舗を作り、続きは編集画面で入れる。作った店舗は掲載許可が「未取得」なので、
 * 許可を取って「許可済み」にするまで来訪者には出ない。
 * 登録済みの店舗と同じ名前なら、二重に作らないよう、先にその店舗を見せて確かめる。
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/admin/toast";

type Category = { id: string; name: string };
type ExistingShop = { id: string; name: string; storeNumber: number | null };

const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-3 text-base text-nicchyo-ink placeholder:text-nicchyo-ink/40 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200";

/** 空白の違い・全角半角・大文字小文字の違いは同じ名前とみなす */
export function normalizeShopName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export function NewShopForm({ shops, onClose }: { shops: ExistingShop[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmedDuplicate, setConfirmedDuplicate] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/admin/categories");
        if (res.ok) setCategories(((await res.json()) as { categories: Category[] }).categories ?? []);
      } catch {
        // カテゴリは任意。取れなくても店名だけで作れる
      }
    })();
  }, []);

  const duplicates = useMemo(() => {
    const key = normalizeShopName(name);
    return key === "" ? [] : shops.filter((s) => normalizeShopName(s.name) === key);
  }, [name, shops]);

  const create = async () => {
    const trimmed = name.trim();
    if (trimmed === "") {
      showToast.error("店名を入力してください");
      return;
    }
    if (duplicates.length > 0 && !confirmedDuplicate) {
      showToast.error("同じ名前の店舗があります。確かめてください");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/shops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop_name: trimmed, category_id: categoryId || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "店舗を作れませんでした");
      showToast.success("店舗を作りました。続きの情報を入れてください");
      router.push(`/admin/field/${data.id}`);
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "店舗を作れませんでした");
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-card border border-amber-300 bg-amber-50 p-4" aria-label="新しい店舗を登録">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-nicchyo-ink">新しい店舗を登録</h2>
        <button type="button" onClick={onClose} className="text-sm text-nicchyo-ink/60 underline">
          閉じる
        </button>
      </div>
      <p className="text-[13px] text-nicchyo-ink/60">
        2024年の住所録に無い店舗を作ります。作った店舗は「許可が未取得」で、許可を取って「許可済み」にするまで来訪者には出ません。
      </p>
      <label className="block">
        <span className="mb-1 block text-[13px] font-medium text-nicchyo-ink/70">店名</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setConfirmedDuplicate(false);
          }}
          maxLength={100}
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-medium text-nicchyo-ink/70">カテゴリ（あとで入れてもよい）</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
          <option value="">未設定</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {duplicates.length > 0 ? (
        <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-white p-3 text-sm">
          <p className="font-semibold text-red-700">同じ名前の店舗がすでにあります</p>
          <ul className="space-y-1">
            {duplicates.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/field/${s.id}`} className="text-nicchyo-ink underline">
                  {s.name}
                  {s.storeNumber != null ? `（店番 ${s.storeNumber}）` : ""}
                </Link>
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={confirmedDuplicate} onChange={(e) => setConfirmedDuplicate(e.target.checked)} />
            <span>別の店舗なので、新しく作る</span>
          </label>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void create()}
        disabled={busy || name.trim() === "" || (duplicates.length > 0 && !confirmedDuplicate)}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-amber-500 px-4 py-3 text-base font-semibold text-white disabled:opacity-50"
      >
        {busy ? "作っています…" : "この店舗を作る"}
      </button>
    </section>
  );
}
