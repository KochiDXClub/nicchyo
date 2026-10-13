"use client";

import { useCallback, useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Button, Surface } from "@/components/ui";
import { LoadingButton } from "@/components/admin";
import { showToast } from "@/lib/admin/toast";
import { fetchShopClaims, issueClaims, type IssueResult, type ShopClaimRow } from "@/lib/admin/shopClaimsClient";
import { ClaimStateBadge } from "../../../shop-claims/components/ClaimStateBadge";
import { UnlinkShopModal } from "../../../shop-claims/components/UnlinkShopModal";
import ShopActivityModal from "../../../shop-claims/components/ShopActivityModal";
import QrSheet from "../../../shop-claims/components/QrSheet";

/**
 * 店舗の詳細に置く「代表者・QRコード」。出店者に配るQRの発行（再発行）、紐づけの解除、操作ログ。
 * 発行したQRの中身は、発行した応答でしか見られない（閉じる・読み込み直すと二度と表示できない）。
 */
export function ShopClaimSection({ vendorId }: { vendorId: string }) {
  const [claim, setClaim] = useState<ShopClaimRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [results, setResults] = useState<IssueResult[] | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<ShopClaimRow | null>(null);
  const [logTarget, setLogTarget] = useState<ShopClaimRow | null>(null);

  const load = useCallback(async () => {
    try {
      const shops = await fetchShopClaims();
      setClaim(shops.find((s) => s.vendorId === vendorId) ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "代表者の情報を読み込めませんでした");
    }
  }, [vendorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleIssue = async () => {
    setIssuing(true);
    try {
      const issued = await issueClaims([vendorId]);
      setResults(issued);
      if (issued.some((r) => r.status === "ok")) showToast.success("QRコードを発行しました");
      else showToast.error("QRコードを発行できませんでした（すでに代表者がいる場合は、先に紐づけを解除してください）");
      await load();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "QRコードを発行できませんでした");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <Surface as="section" padding="sm" aria-label="代表者とQRコード">
      <h2 className="mb-3 text-sm font-semibold text-nicchyo-ink/70">代表者・QRコード</h2>
      {error ? (
        <p role="alert" className="text-sm text-rose-700">{error}</p>
      ) : !claim ? (
        <p className="text-sm text-nicchyo-ink/55">読み込み中…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <ClaimStateBadge state={claim.state} />
            <span className="text-sm text-nicchyo-ink/70">メンバー {claim.memberCount}人</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="quiet" size="sm" onClick={() => setLogTarget(claim)}>操作ログ</Button>
              {claim.state === "claimed" ? (
                <Button variant="quiet" size="sm" className="text-rose-700 hover:bg-rose-50" onClick={() => setUnlinkTarget(claim)}>
                  紐づけを解除
                </Button>
              ) : (
                <LoadingButton
                  isLoading={issuing}
                  loadingText="発行しています…"
                  onClick={handleIssue}
                  className="rounded-chip bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500"
                >
                  {claim.state === "qr_issued" ? "QRを再発行" : "QRを発行"}
                </LoadingButton>
              )}
            </div>
          </div>
          <p className="text-[13px] text-nicchyo-ink/55">
            出店者に配るQRコードで、Googleアカウントを店舗の代表者として紐づけます。再発行すると前のQRは使えなくなります。
          </p>

          {results && results.some((r) => r.status === "ok") && (
            <div className="space-y-3 rounded-card border border-amber-300 bg-amber-50 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-semibold text-amber-900">
                  発行したQRコードです。閉じる・読み込み直すと、二度と表示できません（出し直しはできます）。
                </p>
                <Button size="sm" className="ml-auto" onClick={() => window.print()}>
                  <Printer size={14} aria-hidden /> 印刷する
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setResults(null)}>閉じる</Button>
              </div>
              <QrSheet results={results} />
            </div>
          )}
        </div>
      )}
      <UnlinkShopModal shop={unlinkTarget} onClose={() => setUnlinkTarget(null)} onUnlinked={load} />
      <ShopActivityModal shop={logTarget} onClose={() => setLogTarget(null)} />
    </Surface>
  );
}
