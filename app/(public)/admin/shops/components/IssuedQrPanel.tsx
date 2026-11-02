"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * 発行したQRコードを見せる枠（印刷する・閉じる）。QRの中身は発行した応答でしか見られないので、
 * 閉じる・読み込み直す前に印刷してもらう。中に QrSheet などを入れる。QR一括発行と店舗詳細で共通。
 */
export function IssuedQrPanel({
  onClose,
  message = "発行したQRコードです。この画面を閉じる・読み込み直すと、二度と表示できません（出し直しはできます）。",
  notice,
  children,
}: {
  onClose: () => void;
  message?: string;
  /** 発行できなかった店舗の案内など、枠の中に足す一言 */
  notice?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-card border border-amber-300 bg-amber-50 p-4" aria-label="発行したQRコード">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold text-amber-900">{message}</p>
        <Button size="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer size={14} aria-hidden /> 印刷する
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>閉じる</Button>
      </div>
      {notice && <p className="text-xs text-amber-900">{notice}</p>}
      {children}
    </section>
  );
}
