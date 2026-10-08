"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { AdminLayout, AdminPageHeader, EmptyState, LoadingButton, Modal } from "@/components/admin";
import { useAuth } from "@/lib/auth/AuthContext";
import { showToast } from "@/lib/admin/toast";
import { fetchShopClaims, issueClaims, unlinkShop, type IssueResult, type ShopClaimRow } from "@/lib/admin/shopClaimsClient";
import type { ShopClaimState } from "@/lib/vendor/shopClaim";
import QrSheet from "./components/QrSheet";
import ShopActivityModal from "./components/ShopActivityModal";

const STATE_LABEL: Record<ShopClaimState, { text: string; className: string }> = {
  claimed: { text: "代表者あり", className: "bg-green-700 text-white" },
  qr_issued: { text: "QR発行済み・未紐づけ", className: "bg-amber-600 text-white" },
  unclaimed: { text: "未発行", className: "bg-nicchyo-ink/60 text-white" },
};

type Filter = "all" | ShopClaimState;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "unclaimed", label: "未発行" },
  { key: "qr_issued", label: "QR発行済み" },
  { key: "claimed", label: "代表者あり" },
];

/**
 * 店舗のQRコード。店舗データを先に入れ（アカウントなし）、出店者に配るQRコードで、Googleアカウントを代表者として紐づける。
 *   - QR の発行（再発行）: 前のQRは無効になる。代表者がいる店舗には発行できない
 *   - 紐づけの解除: メンバー全員を外し、店舗をアカウントなしに戻す（QR をなくした・乗っ取られた・出店をやめたとき）
 * 発行したQRの中身は、この画面でしか見られない（サーバーには残さない）。
 */
export default function AdminShopClaimsPage() {
  const { permissions, isLoading } = useAuth();
  const router = useRouter();
  const [shops, setShops] = useState<ShopClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [issuing, setIssuing] = useState(false);
  const [results, setResults] = useState<IssueResult[] | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<ShopClaimRow | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [logTarget, setLogTarget] = useState<ShopClaimRow | null>(null);

  useEffect(() => {
    if (!isLoading && !permissions.isAdmin) router.push("/");
  }, [isLoading, permissions.isAdmin, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setShops(await fetchShopClaims());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "店舗の一覧を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading && permissions.isAdmin) void load();
  }, [isLoading, permissions.isAdmin, load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shops.filter((s) => (filter === "all" || s.state === filter) && (!q || s.shopName.toLowerCase().includes(q)));
  }, [shops, filter, query]);

  // 代表者がいる店舗には発行できないので、選べるのは「まだ代表者がいない店舗」だけ
  const selectable = visible.filter((s) => s.state !== "claimed");
  const allSelected = selectable.length > 0 && selectable.every((s) => selected.has(s.vendorId));
  const counts = useMemo(() => {
    const c: Record<ShopClaimState, number> = { claimed: 0, qr_issued: 0, unclaimed: 0 };
    for (const s of shops) c[s.state] += 1;
    return c;
  }, [shops]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of selectable) {
        if (allSelected) next.delete(s.vendorId);
        else next.add(s.vendorId);
      }
      return next;
    });

  const handleIssue = async (ids: string[]) => {
    if (ids.length === 0) return;
    setIssuing(true);
    try {
      const issued = await issueClaims(ids);
      setResults(issued);
      setSelected(new Set());
      const ok = issued.filter((r) => r.status === "ok").length;
      const skipped = issued.length - ok;
      showToast.success(`${ok}店舗のQRコードを発行しました${skipped > 0 ? `（${skipped}店舗は発行できませんでした）` : ""}`);
      await load();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "QRコードを発行できませんでした");
    } finally {
      setIssuing(false);
    }
  };

  const handleUnlink = async () => {
    if (!unlinkTarget) return;
    setUnlinking(true);
    try {
      const { removedMembers } = await unlinkShop(unlinkTarget.vendorId);
      showToast.success(`${unlinkTarget.shopName}の紐づけを解除しました（${removedMembers}人が外れました）`);
      setUnlinkTarget(null);
      await load();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "解除できませんでした");
    } finally {
      setUnlinking(false);
    }
  };

  if (isLoading || !permissions.isAdmin) return null;

  return (
    <AdminLayout>
      <AdminPageHeader
        eyebrow="Shop QR"
        title="店舗のQRコード"
        description="出店者に配るQRコードを発行し、Googleアカウントを店舗の代表者として紐づけます。"
      />
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 pb-20">
        <p className="text-sm text-nicchyo-ink/70">
          代表者あり {counts.claimed} ／ QR発行済み・未紐づけ {counts.qr_issued} ／ 未発行 {counts.unclaimed}
        </p>

        {results && results.some((r) => r.status === "ok") && (
          <section className="space-y-3 rounded-card border border-amber-300 bg-amber-50 p-4" aria-label="発行したQRコード">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-amber-900">
                発行したQRコードです。この画面を閉じる・読み込み直すと、二度と表示できません（出し直しはできます）。
              </p>
              <button
                type="button"
                onClick={() => window.print()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
              >
                <Printer size={14} aria-hidden /> 印刷する
              </button>
              <button type="button" onClick={() => setResults(null)} className="rounded-lg px-3 py-2 text-sm text-nicchyo-ink/70 hover:bg-white">
                閉じる
              </button>
            </div>
            {results.filter((r) => r.status !== "ok").length > 0 && (
              <p className="text-xs text-amber-900">
                発行できなかった店舗: {results.filter((r) => r.status !== "ok").map((r) => r.shopName ?? r.vendorId).join("、")}
                （すでに代表者がいる店舗は、先に「紐づけを解除」してください）
              </p>
            )}
            <QrSheet results={results} />
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === f.key ? "bg-nicchyo-ink text-white" : "bg-white text-nicchyo-ink/70 ring-1 ring-line hover:bg-nicchyo-base"}`}
            >
              {f.label}
            </button>
          ))}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="店名で探す"
            aria-label="店名で探す"
            className="ml-auto w-56 rounded-lg border border-line px-3 py-1.5 text-sm"
          />
          <LoadingButton
            isLoading={issuing}
            loadingText="発行しています…"
            disabled={selected.size === 0}
            onClick={() => handleIssue([...selected])}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
          >
            選んだ店舗のQRを発行（{selected.size}）
          </LoadingButton>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? null : visible.length === 0 ? (
          <EmptyState title="該当する店舗がありません" description="絞り込みを変えてみてください。" />
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-nicchyo-base text-xs text-nicchyo-ink/55">
                <tr>
                  <th className="w-10 px-3 py-2">
                    <input type="checkbox" aria-label="代表者がいない店舗をすべて選ぶ" checked={allSelected} onChange={toggleAll} disabled={selectable.length === 0} />
                  </th>
                  <th className="px-3 py-2">店名</th>
                  <th className="px-3 py-2">状態</th>
                  <th className="px-3 py-2">メンバー</th>
                  <th className="px-3 py-2 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visible.map((shop) => (
                  <tr key={shop.vendorId}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label={`${shop.shopName}を選ぶ`}
                        checked={selected.has(shop.vendorId)}
                        disabled={shop.state === "claimed"}
                        onChange={() => toggle(shop.vendorId)}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium text-nicchyo-ink">{shop.shopName}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${STATE_LABEL[shop.state].className}`}>
                        {STATE_LABEL[shop.state].text}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-nicchyo-ink/70">{shop.memberCount}人</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => setLogTarget(shop)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-nicchyo-ink/70 hover:bg-nicchyo-ink/[0.06]">
                        操作ログ
                      </button>
                      {shop.state === "claimed" ? (
                        <button type="button" onClick={() => setUnlinkTarget(shop)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50">
                          紐づけを解除
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleIssue([shop.vendorId])}
                          disabled={issuing}
                          className="rounded-lg px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {shop.state === "qr_issued" ? "QRを再発行" : "QRを発行"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={unlinkTarget !== null} onClose={() => !unlinking && setUnlinkTarget(null)} title="紐づけの解除" widthClassName="max-w-md">
        {unlinkTarget && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-nicchyo-ink/70">
              「{unlinkTarget.shopName}」の紐づけを解除します。メンバー {unlinkTarget.memberCount}人（代表者を含む）がお店から外れ、出ている招待リンクとQRコードは使えなくなります。
              店舗の掲載情報（商品・写真・投稿）はそのまま残ります。
            </p>
            <p className="text-xs text-nicchyo-ink/55">解除したあと、QRコードを出し直すと、新しい代表者が紐づけられます。</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setUnlinkTarget(null)} disabled={unlinking} className="rounded-lg px-4 py-2 text-sm text-nicchyo-ink/70 hover:bg-nicchyo-ink/[0.06]">
                やめる
              </button>
              <LoadingButton isLoading={unlinking} loadingText="解除しています…" onClick={handleUnlink} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">
                解除する
              </LoadingButton>
            </div>
          </div>
        )}
      </Modal>
      <ShopActivityModal shop={logTarget} onClose={() => setLogTarget(null)} />
    </AdminLayout>
  );
}
