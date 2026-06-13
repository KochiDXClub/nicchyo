"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ENCYCLOPEDIA_ITEMS } from "@/data/encyclopediaItems";
import { RefreshCw, Download, X } from "lucide-react";
import { motion } from "framer-motion";

function CameraPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = searchParams?.get("item");
  const item = ENCYCLOPEDIA_ITEMS.find((i) => i.id === itemId);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [_stream, setStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isPhotoTaken, setIsPhotoTaken] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: false,
      });
      streamRef.current = newStream;
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("カメラにアクセスできませんでした。ブラウザの設定を確認してください。");
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [startCamera]);
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

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-slate-900">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <X className="text-red-500" size={32} />
            </div>
            <p className="text-sm text-slate-300 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-white text-slate-900 rounded-2xl font-bold text-sm"
            >
              再読み込み
            </button>
          </div>
        )}
      </div>

      {/* Footer Controls */}
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
