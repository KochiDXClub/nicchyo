"use client";

import { QRCodeSVG } from "qrcode.react";
import type { IssueResult } from "@/lib/admin/shopClaimsClient";

/**
 * 発行した QR コードの一覧（印刷用）。1 店舗 1 枚のカードに、店名と QR と使い方を載せる。
 * URL（QR の中身）は、発行した応答でしか見られないので、このシートを閉じると二度と出せない（出し直しはできる）。
 * 印刷するときは、このシート以外を隠す（print: のスタイルは、下の <style> でここだけを残す）。
 */
export default function QrSheet({ results }: { results: IssueResult[] }) {
  const issued = results.filter((r): r is IssueResult & { url: string } => r.status === "ok" && !!r.url);
  if (issued.length === 0) return null;

  return (
    <div className="qr-print-area" data-testid="qr-sheet">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .qr-print-area, .qr-print-area * { visibility: visible; }
          .qr-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .qr-card { break-inside: avoid; }
        }
      `}</style>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {issued.map((result) => (
          <li key={result.vendorId} className="qr-card rounded-card border border-line bg-white p-4 text-center">
            <p className="text-base font-bold text-nicchyo-ink">{result.shopName ?? "お店"}</p>
            <div className="my-3 flex justify-center">
              <QRCodeSVG value={result.url} size={168} level="M" marginSize={2} title={`${result.shopName ?? "お店"}のQRコード`} />
            </div>
            <p className="text-xs leading-relaxed text-nicchyo-ink/70">
              スマホのカメラでこのQRコードを読み取り、Googleアカウントでログインすると、このお店の代表者として登録されます。
            </p>
            <p className="mt-1 text-[11px] text-nicchyo-ink/40">nicchyo（日曜市デジタルマップ）</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
