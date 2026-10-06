"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, ErrorBoundary } from "@/components/admin";
import type { AdminShop } from "@/app/api/admin/shops/route";
import { ListingStatusBadge } from "../shops/ListingStatusBadge";

type Filter = "all" | "unlisted" | "noLocation" | "noPhoto";

const FILTERS: { key: Filter; label: string; match: (s: AdminShop) => boolean }[] = [
  { key: "all", label: "すべて", match: () => true },
  { key: "unlisted", label: "許可が未取得", match: (s) => s.listingStatus === "pending" },
  { key: "noLocation", label: "位置が未登録", match: (s) => s.storeNumber === null },
  { key: "noPhoto", label: "写真なし", match: (s) => !s.hasPhoto },
];

function FieldListContent() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const [shops, setShops] = useState<AdminShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  useEffect(() => {
    if (isLoading || !permissions.isAdmin) return;
    (async () => {
      try {
        const res = await fetch("/api/admin/shops");
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { shops: AdminShop[] };
        setShops(Array.isArray(data.shops) ? data.shops : []);
      } catch {
        setError("店舗を取得できませんでした。電波の良いところで開き直してください");
      } finally {
        setLoading(false);
      }
    })();
  }, [isLoading, permissions.isAdmin]);

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, shops.filter(f.match).length])) as Record<Filter, number>, [shops]);

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter)!;
    const q = query.trim().toLowerCase();
    return shops
      .filter(active.match)
      .filter((s) => q === "" || s.name.toLowerCase().includes(q) || (s.storeNumber !== null && String(s.storeNumber) === q))
      // 店番の順（位置が未登録の店舗は後ろ）
      .sort((a, b) => (a.storeNumber ?? Infinity) - (b.storeNumber ?? Infinity) || a.name.localeCompare(b.name, "ja"));
  }, [shops, filter, query]);

  if (isLoading || !permissions.isAdmin) return null;

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="Field" title="現場登録" description="日曜市の現地で、店舗の情報・掲載許可・写真・位置を登録します" />
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="店名、または店番の数字"
          aria-label="店舗を探す"
          className="w-full rounded-lg border border-line bg-white px-3 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
                filter === f.key ? "border-nicchyo-ink bg-nicchyo-ink text-white" : "border-line bg-white text-nicchyo-ink/70"
              }`}
            >
              {f.label} {loading ? "" : counts[f.key]}
            </button>
          ))}
        </div>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : loading ? (
          <p className="text-sm text-nicchyo-ink/55">読み込み中…</p>
        ) : visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-nicchyo-ink/55">該当する店舗がありません</p>
        ) : (
          <ul className="space-y-2">
            {visible.map((shop) => (
              <li key={shop.id}>
                <Link
                  href={`/admin/field/${shop.id}`}
                  className="flex min-h-16 items-center gap-3 rounded-card border border-line bg-white p-3 shadow-sm active:bg-nicchyo-base"
                >
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${
                      shop.storeNumber !== null ? "bg-green-50 text-green-700" : "bg-nicchyo-base text-nicchyo-ink/40"
                    }`}
                    aria-label={shop.storeNumber !== null ? `店番 ${shop.storeNumber}` : "位置が未登録"}
                  >
                    {shop.storeNumber ?? "–"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-nicchyo-ink">{shop.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <ListingStatusBadge status={shop.listingStatus} />
                      {!shop.hasPhoto ? <span className="text-[11px] text-nicchyo-ink/55">写真なし</span> : null}
                      {shop.category !== "未分類" ? <span className="text-[11px] text-nicchyo-ink/55">{shop.category}</span> : null}
                    </span>
                  </span>
                  <span aria-hidden className="text-nicchyo-ink/40">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}

export default function AdminFieldPage() {
  return (
    <ErrorBoundary>
      <FieldListContent />
    </ErrorBoundary>
  );
}
