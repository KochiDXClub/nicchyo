"use client";

/**
 * QRコードスキャナーコンポーネント
 * html5-qrcode を動的に読み込み、カメラでQRコードを読み取る
 */

import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";

type Props = {
  onScan: (value: string) => void;
  active: boolean;
};

const SCANNER_ELEMENT_ID = "qr-scanner-region";

export default function QrScanner({ onScan, active }: Props) {
  const scannerRef = useRef<import("html5-qrcode").Html5QrcodeScanner | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    let mounted = true;

    import("html5-qrcode").then(({ Html5QrcodeScanner, Html5QrcodeScanType }) => {
      if (!mounted) return;

      // 既存インスタンスがあればクリア
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }

      const scanner = new Html5QrcodeScanner(
        SCANNER_ELEMENT_ID,
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
          rememberLastUsedCamera: true,
          showTorchButtonIfSupported: true,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          onScan(decodedText);
        },
        () => {
          // スキャン失敗は都度発生するため無視
        }
      );

      scannerRef.current = scanner;
    }).catch(() => {
      if (mounted) setCameraError("カメラの初期化に失敗しました");
    });

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [active, onScan]);

  if (cameraError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-8 text-center">
        <CameraOff size={36} className="text-red-400" />
        <p className="text-sm text-red-600">{cameraError}</p>
        <p className="text-xs text-red-400">
          ブラウザのカメラ許可を確認してください
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
      {/* html5-qrcode がここにカメラ映像を描画する */}
      <div id={SCANNER_ELEMENT_ID} />
    </div>
  );
}
