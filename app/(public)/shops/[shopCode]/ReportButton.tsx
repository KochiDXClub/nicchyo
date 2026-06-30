"use client";

import { useState } from "react";

const REASONS = [
  "誤った情報",
  "不適切なコンテンツ",
  "スパム・宣伝",
  "著作権侵害",
  "その他",
] as const;

type Reason = typeof REASONS[number];

interface Props {
  shopCode: string;
  shopName: string;
}

export default function ReportButton({ shopCode, shopName }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | "">("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_type: "vendor",
          target_id: shopCode,
          target_name: shopName,
          reason,
          details,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "failed");
      }
      setDone(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "通報の送信に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
      >
        この情報を通報する
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => !loading && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center">
                <p className="text-2xl">✅</p>
                <p className="mt-2 font-semibold text-slate-800">通報を受け付けました</p>
                <p className="mt-1 text-sm text-slate-500">内容を確認し、適切に対応いたします。</p>
                <button
                  type="button"
                  onClick={() => { setOpen(false); setDone(false); setReason(""); setDetails(""); }}
                  className="mt-4 w-full rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-700"
                >
                  閉じる
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-bold text-slate-900">情報を通報する</h2>
                <p className="mt-1 text-xs text-slate-500">
                  「{shopName}」に関する問題を報告してください。
                </p>

                <div className="mt-4 space-y-2">
                  {REASONS.map((r) => (
                    <label key={r} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="radio"
                        name="reason"
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="accent-amber-600"
                      />
                      <span className="text-sm text-slate-700">{r}</span>
                    </label>
                  ))}
                </div>

                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="詳細（任意）"
                  maxLength={500}
                  rows={3}
                  className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-amber-400 focus:outline-none"
                />

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!reason || loading}
                    className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {loading ? "送信中..." : "通報する"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-slate-100 py-2 text-sm font-medium text-slate-700"
                  >
                    キャンセル
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
