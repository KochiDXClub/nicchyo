"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, ErrorBoundary } from "@/components/admin";
import type { ListingStatus } from "@/lib/admin/shopEdit";
import { PAYMENT_OPTIONS, RAIN_OPTIONS } from "@/lib/vendor/storeOptions";
import { ListingStatusBadge } from "../ListingStatusBadge";

type ShopDetail = {
  id: string;
  shop_name: string;
  category_name: string | null;
  style: string | null;
  strength: string | null;
  main_products: string[] | null;
  main_product_prices: Record<string, number | null> | null;
  payment_methods: string[] | null;
  rain_policy: string | null;
  sns_instagram: string | null;
  sns_x: string | null;
  sns_hp: string | null;
  business_hours_start: string | null;
  business_hours_end: string | null;
  shop_image_url: string | null;
  listing_status: ListingStatus;
  photo_use_allowed: boolean;
  listing_consented_on: string | null;
  listing_consent_note: string | null;
  owner_name: string | null;
  store_number: number | null;
  updated_at: string | null;
};

const EMPTY = "未入力";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr]">
      <dt className="text-[13px] text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-900">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-700">{title}</h2>
      <dl>{children}</dl>
    </section>
  );
}

const orEmpty = (value: string | null | undefined) => (value ? value : <span className="text-slate-400">{EMPTY}</span>);

function AdminShopDetailContent() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  useEffect(() => {
    if (isLoading || !permissions.isAdmin || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/shops/${id}`);
        if (res.status === 404) throw new Error("店舗が見つかりません");
        if (!res.ok) throw new Error("店舗の取得に失敗しました");
        const data = (await res.json()) as { shop: ShopDetail };
        if (!cancelled) setShop(data.shop);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "店舗の取得に失敗しました");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isLoading, permissions.isAdmin]);

  if (isLoading || !permissions.isAdmin) return null;

  const products = shop?.main_products ?? [];
  const prices = shop?.main_product_prices ?? {};
  const payments = (shop?.payment_methods ?? []).map((key) => PAYMENT_OPTIONS.find((o) => o.key === key)?.label ?? key);
  const rain = RAIN_OPTIONS.find((o) => o.key === shop?.rain_policy)?.label ?? (shop?.rain_policy === "tent" ? "テントで出店" : null);

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Shop"
        title={shop?.shop_name ?? "店舗の詳細"}
        description="店舗の登録内容を確認できます（閲覧のみ）"
        actions={
          <Link href="/admin/shops" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            一覧へ
          </Link>
        }
      />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        ) : !shop ? (
          <p className="text-sm text-slate-500">読み込み中…</p>
        ) : (
          <>
            <Section title="掲載の許可">
              <Row label="掲載許可">
                <ListingStatusBadge status={shop.listing_status} />
                {shop.listing_status !== "allowed" ? (
                  <span className="ml-2 text-[13px] text-slate-500">来訪者には表示されません</span>
                ) : null}
              </Row>
              <Row label="写真の使用">{shop.photo_use_allowed ? "許可あり" : "許可なし（未確認を含む）"}</Row>
              <Row label="許可をもらった日">{orEmpty(shop.listing_consented_on)}</Row>
              <Row label="許可のメモ">{orEmpty(shop.listing_consent_note)}</Row>
            </Section>

            <Section title="基本情報">
              <Row label="店名">{shop.shop_name}</Row>
              <Row label="店番">{shop.store_number != null ? `${shop.store_number} 番` : <span className="text-slate-400">位置が未登録</span>}</Row>
              <Row label="カテゴリ">{orEmpty(shop.category_name)}</Row>
              <Row label="店主名">{orEmpty(shop.owner_name)}</Row>
              <Row label="こだわり">{orEmpty(shop.strength)}</Row>
              <Row label="出店スタイル">{orEmpty(shop.style)}</Row>
              <Row label="店舗写真">
                {shop.shop_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shop.shop_image_url} alt={`${shop.shop_name}の写真`} className="max-h-60 rounded-lg border border-slate-200" />
                ) : (
                  <span className="text-slate-400">{EMPTY}</span>
                )}
              </Row>
            </Section>

            <Section title="商品と価格">
              {products.length === 0 ? (
                <Row label="主な商品">
                  <span className="text-slate-400">{EMPTY}</span>
                </Row>
              ) : (
                products.map((name) => (
                  <Row key={name} label={name}>
                    {typeof prices[name] === "number" ? `${prices[name]!.toLocaleString()}円` : <span className="text-slate-400">価格未入力</span>}
                  </Row>
                ))
              )}
            </Section>

            <Section title="出店の情報">
              <Row label="営業時間">
                {shop.business_hours_start && shop.business_hours_end ? `${shop.business_hours_start} 〜 ${shop.business_hours_end}` : orEmpty(null)}
              </Row>
              <Row label="決済方法">{payments.length > 0 ? payments.join("、") : orEmpty(null)}</Row>
              <Row label="雨天時">{orEmpty(rain)}</Row>
            </Section>

            <Section title="SNS・ホームページ">
              <Row label="Instagram">{orEmpty(shop.sns_instagram)}</Row>
              <Row label="X">{orEmpty(shop.sns_x)}</Row>
              <Row label="ホームページ">{orEmpty(shop.sns_hp)}</Row>
            </Section>

            <p className="text-right text-xs text-slate-400">
              最終更新: {shop.updated_at ? new Date(shop.updated_at).toLocaleString("ja-JP") : "-"}
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

export default function AdminShopDetailPage() {
  return (
    <ErrorBoundary>
      <AdminShopDetailContent />
    </ErrorBoundary>
  );
}
