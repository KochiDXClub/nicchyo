"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ENCYCLOPEDIA_ITEMS } from "@/data/encyclopediaItems";
import { RefreshCw, Download, X, Camera } from "lucide-react";
import { motion } from "framer-motion";

function CameraPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams?.get("item");
  const item = ENCYCLOPEDIA_ITEMS.find((i) => i.id === itemId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // 起動要求の世代番号。多重起動時に古い取得結果を破棄するために使う
  const startGenerationRef = useRef(0);
  const [isPhotoTaken, setIsPhotoTaken] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 権限拒否などで再要求ボタンを出すかどうか
  const [isPermissionBlocked, setIsPermissionBlocked] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const startCamera = useCallback(async () => {
    // 既存ストリームを停止してから取得し直す（カメラ切り替え時）
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // ブラウザがカメラAPIに非対応、または非セキュアコンテキスト（http）の場合
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("このブラウザではカメラを利用できません。HTTPS環境で最新のブラウザをお使いください。");
      setIsPermissionBlocked(false);
      setIsInitializing(false);
      return;
    }

    // この呼び出しの世代番号。完了時に最新でなければ結果を破棄する（多重起動防止）
    const generation = ++startGenerationRef.current;

    setIsInitializing(true);
    setError(null);
    setIsPermissionBlocked(false);

    // 指定 facingMode で取得し、カメラ使用中などで開けない場合は制約を緩めて再試行する
    const requestStream = async () => {
      try {
        // getUserMedia の呼び出しがブラウザ標準のカメラ許可ダイアログを表示する
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        // 指定カメラが使用中/未対応の場合は、制約なしでもう一度試す
        if (name === "NotReadableError" || name === "OverconstrainedError" || name === "TrackStartError") {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        throw err;
      }
    };

    try {
      const newStream = await requestStream();

      // 取得中に新しい起動要求が始まっていたら、このストリームは破棄する
      if (generation !== startGenerationRef.current) {
        newStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = newStream;
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
      setIsPermissionBlocked(false);
    } catch (err) {
      // 古い起動要求のエラーは無視する
      if (generation !== startGenerationRef.current) return;
      console.error("Camera error:", err);
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        setError("カメラへのアクセスが許可されていません。撮影するにはカメラの使用を許可してください。");
        setIsPermissionBlocked(true);
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("カメラが見つかりませんでした。カメラ付きの端末でお試しください。");
        setIsPermissionBlocked(false);
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setError("カメラを起動できませんでした。他のアプリやタブがカメラを使用していないか確認して、もう一度お試しください。");
        setIsPermissionBlocked(true);
      } else {
        setError("カメラにアクセスできませんでした。ブラウザの設定を確認してください。");
        setIsPermissionBlocked(true);
      }
    } finally {
      // 最新の起動要求のときだけ初期化中フラグを下ろす
      if (generation === startGenerationRef.current) {
        setIsInitializing(false);
      }
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      // 進行中の取得結果を無効化し、ストリームを完全に解放する
      // eslint-disable-next-line react-hooks/exhaustive-deps
      startGenerationRef.current++;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [startCamera]);

  // 「撮り直す」で <video> が再マウントされた際に、保持中のストリームを再アタッチする
  useEffect(() => {
    if (!isPhotoTaken && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isPhotoTaken]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // キャンバスサイズをビデオに合わせる
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // ビデオを描画
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // フレームと装飾を合成
    drawFrame(context, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/webp");
    setCapturedImage(dataUrl);
    setIsPhotoTaken(true);
  };

  const drawFrame = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // 簡易的なフレーム描画
    const padding = 40;

    // 角の装飾
    ctx.strokeStyle = "rgba(251, 191, 36, 0.8)"; // amber-400
    ctx.lineWidth = 15;

    const len = 80;
    // Top-left
    ctx.beginPath(); ctx.moveTo(padding, padding + len); ctx.lineTo(padding, padding); ctx.lineTo(padding + len, padding); ctx.stroke();
    // Top-right
    ctx.beginPath(); ctx.moveTo(width - padding - len, padding); ctx.lineTo(width - padding, padding); ctx.lineTo(width - padding, padding + len); ctx.stroke();
    // Bottom-left
    ctx.beginPath(); ctx.moveTo(padding, height - padding - len); ctx.lineTo(padding, height - padding); ctx.lineTo(padding + len, height - padding); ctx.stroke();
    // Bottom-right
    ctx.beginPath(); ctx.moveTo(width - padding - len, height - padding); ctx.lineTo(width - padding, height - padding); ctx.lineTo(width - padding, height - padding - len); ctx.stroke();

    // 日付とロゴ
    const dateStr = new Date().toLocaleDateString("ja-JP");
    ctx.fillStyle = "white";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "black";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Kochi Sunday Market", width - 60, height - 60);
    ctx.font = "30px sans-serif";
    ctx.fillText(dateStr, width - 60, height - 110);

    // アイテムのスタンプ
    if (item) {
      ctx.font = "120px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(item.emoji, 120, height - 80);
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(item.name, 120, height - 40);
    }
  };

  const downloadPhoto = () => {
    if (!capturedImage) return;
    const link = document.createElement("a");
    link.href = capturedImage;
    link.download = `nicchyo-discovery-${itemId || "photo"}.webp`;
    link.click();
  };

  return (
    <main className="fixed inset-0 z-[10000] bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-6 bg-gradient-to-b from-black/60 to-transparent">
        <button onClick={() => router.back()} className="rounded-full bg-white/10 p-2 backdrop-blur-md">
          <X size={24} />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-bold tracking-widest uppercase">
            {isPhotoTaken ? "完成！" : "記念撮影"}
          </h1>
          {item && !isPhotoTaken && <p className="text-xs text-amber-400 mt-0.5">{item.name}と一緒に</p>}
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      {/* Camera View / Captured Image */}
      <div className="relative flex-1 flex items-center justify-center">
        {!isPhotoTaken ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            {/* プレビュー上のフレーム演出 */}
            <div className="absolute inset-0 pointer-events-none p-10 border-[30px] border-black/10">
              <div className="w-full h-full border-2 border-white/30 rounded-2xl flex flex-col items-center justify-between p-6">
                <div className="self-end text-white/50 text-[10px] font-bold tracking-widest">
                  LIVE PREVIEW
                </div>
                {item && (
                  <div className="self-start flex flex-col items-center gap-1 opacity-80">
                    <span className="text-6xl">{item.emoji}</span>
                    <span className="text-xs font-bold text-white shadow-sm">{item.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="relative w-full h-full p-4 flex items-center justify-center">
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              src={capturedImage!}
              alt="Captured"
              className="max-w-full max-h-full rounded-3xl shadow-2xl"
            />
          </div>
        )}

        {/* 起動中（カメラ許可ダイアログの応答待ちを含む） */}
        {!isPhotoTaken && isInitializing && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center bg-slate-900/95">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-amber-400" />
            <div>
              <p className="text-sm font-bold text-white">カメラを起動しています…</p>
              <p className="mt-1 text-xs text-slate-400">許可を求められたら「許可」を選んでください</p>
            </div>
          </div>
        )}

        {/* エラー・許可拒否時の案内 */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
              <Camera className="text-amber-400" size={32} />
            </div>
            <p className="mb-2 text-base font-bold text-white">カメラを使えるようにしましょう</p>
            <p className="mb-6 max-w-xs text-sm leading-relaxed text-slate-300">{error}</p>

            <button
              onClick={startCamera}
              disabled={isInitializing}
              className="mb-3 w-full max-w-xs rounded-2xl bg-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/30 transition active:scale-95 disabled:opacity-60"
            >
              {isInitializing ? "起動中…" : "カメラを許可する"}
            </button>

            {isPermissionBlocked && (
              <p className="mb-4 max-w-xs text-[11px] leading-relaxed text-slate-500">
                ボタンを押しても表示されない場合は、ブラウザのアドレスバーの🔒（鍵マーク）からカメラを「許可」に変更し、再度お試しください。
              </p>
            )}

            <button
              onClick={() => router.back()}
              className="text-xs font-semibold text-slate-400 underline-offset-2 hover:underline"
            >
              撮影をやめて戻る
            </button>
          </div>
        )}
      </div>

      {/* Footer Controls（エラー・起動中はシャッターを隠す） */}
      {!(error || (isInitializing && !isPhotoTaken)) && (
      <div className="absolute bottom-0 left-0 right-0 z-20 p-8 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-8">
          {!isPhotoTaken ? (
            <>
              <button
                onClick={toggleCamera}
                className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md active:scale-90 transition-transform"
              >
                <RefreshCw size={24} />
              </button>

              <button
                onClick={takePhoto}
                className="h-20 w-20 rounded-full bg-white p-1 flex items-center justify-center shadow-lg shadow-white/20 active:scale-95 transition-transform"
              >
                <div className="h-full w-full rounded-full border-4 border-black/5 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full bg-slate-900" />
                </div>
              </button>

              <div className="h-14 w-14" /> {/* Placeholder for balance */}
            </>
          ) : (
            <>
              <button
                onClick={() => setIsPhotoTaken(false)}
                className="flex-1 rounded-2xl bg-white/10 py-4 text-sm font-bold backdrop-blur-md active:scale-95 transition-transform"
              >
                撮り直す
              </button>
              <button
                onClick={downloadPhoto}
                className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-4 text-sm font-bold text-white shadow-lg shadow-amber-500/30 active:scale-95 transition-transform"
              >
                <Download size={18} />
                保存する
              </button>
            </>
          )}
        </div>
      </div>
      )}

      {/* Hidden Canvas for Processing */}
      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <CameraPageContent />
    </Suspense>
  );
}
