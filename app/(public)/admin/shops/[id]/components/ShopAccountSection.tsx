"use client";

import { useCallback, useEffect, useState } from "react";
import { Surface } from "@/components/ui";
import { fetchShopClaims, type ShopClaimRow } from "@/lib/admin/shopClaimsClient";
import { ShopClaimSection } from "./ShopClaimSection";
import { ShopInviteSection } from "./ShopInviteSection";

/**
 * 店舗の詳細の「出店者アカウント」。この店舗にどのアカウントを入れるか、の操作をまとめる。
 *   - 代表者: QRコードで決める（最初の1人）
 *   - メンバー: 招待リンクで足す（代表者がいる店舗のみ）
 * 状態（代表者の有無）は招待リンクの出し分けにも使うので、ここで1回だけ読む。
 */
export function ShopAccountSection({ vendorId }: { vendorId: string }) {
  const [claim, setClaim] = useState<ShopClaimRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const shops = await fetchShopClaims();
      setClaim(shops.find((s) => s.vendorId === vendorId) ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "アカウントの情報を読み込めませんでした");
    }
  }, [vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Surface as="section" padding="sm" aria-label="出店者アカウント" className="space-y-6">
      <h2 className="text-sm font-semibold text-nicchyo-ink/70">出店者アカウント</h2>
      {error ? (
        <p role="alert" className="text-sm text-rose-700">{error}</p>
      ) : !claim ? (
        <p className="text-sm text-nicchyo-ink/55">読み込み中…</p>
      ) : (
        <>
          <ShopClaimSection claim={claim} onChanged={load} />
          <ShopInviteSection claim={claim} />
        </>
      )}
    </Surface>
  );
}
