"use client";

export const dynamic = "force-dynamic";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Loader2, Send, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  VENDOR_INQUIRY_BODY_MAX_LENGTH,
  VENDOR_INQUIRY_TOPICS,
  VENDOR_INQUIRY_URGENCIES,
  type VendorInquiryTopic,
  type VendorInquiryUrgency,
} from "@/lib/vendorInquiries/constants";
import {
  CATEGORY_LABELS,
  REPORT_PATTERNS,
  TOPIC_LABELS,
  URGENCY_LABELS,
  buildReportBody,
  findReportPattern,
} from "@/lib/vendorInquiries/labels";
import { createInquiry, uploadInquiryImage } from "../../_services/inquiriesService";

// 質問・相談の宛先。報告・連絡は選んだ定型パターンごとに決まる（REPORT_PATTERNS.category）
const CATEGORY_BY_TOPIC = {
  question: "operator",
  consultation: "both",
} as const;

export default function NewVendorInquiryPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [topic, setTopic] = useState<VendorInquiryTopic | null>(null);
  const [patternId, setPatternId] = useState<string | null>(null);
  const [patternValues, setPatternValues] = useState<Record<string, string>>({});
  const [freeText, setFreeText] = useState("");
  const [urgency, setUrgency] = useState<VendorInquiryUrgency>("normal");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pattern = patternId ? findReportPattern(patternId) : undefined;

  const category = useMemo(() => {
    if (topic === "report") return pattern?.category ?? null;
    if (topic) return CATEGORY_BY_TOPIC[topic];
    return null;
  }, [topic, pattern]);

  // 送信される本文。報告・連絡は定型パターンの入力を本文へ整形して埋め込む
  const composedBody = useMemo(() => {
    if (topic === "report" && pattern) return buildReportBody(pattern, patternValues, freeText);
    return freeText.trim();
  }, [topic, pattern, patternValues, freeText]);

  const missingRequired = useMemo(() => {
    if (topic !== "report" || !pattern) return false;
    return pattern.fields.some((f) => f.required && !patternValues[f.name]?.trim());
  }, [topic, pattern, patternValues]);

  const canSubmit =
    !isSending &&
    topic !== null &&
    category !== null &&
    !missingRequired &&
    composedBody.length > 0 &&
    composedBody.length <= VENDOR_INQUIRY_BODY_MAX_LENGTH &&
    // 報告・連絡は定型パターンの選択が必須。それ以外は本文があればよい
    (topic !== "report" || pattern !== undefined) &&
    (topic === "report" || freeText.trim().length > 0);

  function handlePickImage(file: File | null) {
    setImageFile(file);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  async function handleSubmit() {
    if (!canSubmit || !topic || !category) return;
    setIsSending(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        if (!user?.id) throw new Error("ログイン情報を確認できませんでした");
        imageUrl = await uploadInquiryImage(user.id, imageFile);
      }
      const created = await createInquiry({ topic, category, urgency, body: composedBody, imageUrl });
      router.push(`/vendor/inquiries/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "送信できませんでした");
      setIsSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/vendor/inquiries"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="連絡の一覧へ戻る"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">New Contact</p>
            <h1 className="text-xl font-bold text-slate-900">新しく連絡する</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        {/* 1. 用件を選ぶ */}
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700">どんな用件ですか？</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {VENDOR_INQUIRY_TOPICS.map((t) => {
              const meta = TOPIC_LABELS[t];
              const selected = topic === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTopic(t);
                    setPatternId(null);
                    setPatternValues({});
                  }}
                  aria-pressed={selected}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    selected
                      ? "border-amber-300 bg-amber-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/50"
                  }`}
                >
                  <span className="text-xl" aria-hidden="true">{meta.emoji}</span>
                  <span className="mt-1 block text-sm font-bold text-slate-900">{meta.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{meta.description}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. 報告・連絡なら定型パターンを選ぶ */}
        {topic === "report" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-700">何についての報告ですか？</h2>
            <div className="mt-3 space-y-2">
              {REPORT_PATTERNS.map((p) => {
                const selected = patternId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPatternId(p.id);
                      setPatternValues({});
                    }}
                    aria-pressed={selected}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      selected
                        ? "border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/50"
                    }`}
                  >
                    {p.label}
                    <span className="text-[11px] font-normal text-slate-400">{CATEGORY_LABELS[p.category]}へ</span>
                  </button>
                );
              })}
            </div>

            {/* 選んだパターンの専用入力欄 */}
            {pattern && pattern.fields.length > 0 && (
              <div className="mt-4 space-y-3 rounded-2xl bg-amber-50/60 p-4">
                {pattern.fields.map((field) => (
                  <label key={field.name} className="block">
                    <span className="block text-sm font-semibold text-slate-700">
                      {field.label}
                      {field.required && <span className="ml-1 text-rose-500">*</span>}
                    </span>
                    {field.type === "textarea" ? (
                      <textarea
                        value={patternValues[field.name] ?? ""}
                        onChange={(e) => setPatternValues((v) => ({ ...v, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        rows={3}
                        className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    ) : (
                      <input
                        type={field.type}
                        value={patternValues[field.name] ?? ""}
                        onChange={(e) => setPatternValues((v) => ({ ...v, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
                      />
                    )}
                  </label>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 3. 本文 */}
        {topic && (topic !== "report" || pattern) && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-700">
                {topic === "report" ? "補足があれば（任意）" : "内容"}
              </h2>
              <span className="text-xs text-slate-400">
                {composedBody.length} / {VENDOR_INQUIRY_BODY_MAX_LENGTH}
              </span>
            </div>
            <textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              rows={8}
              placeholder={
                topic === "question"
                  ? "例：出店場所の変更はどこに申請すればいいですか？"
                  : topic === "consultation"
                    ? "例：来月から土曜も出店したいのですが、相談できますか？"
                    : "補足したいことがあれば書いてください"
              }
              className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-base leading-relaxed text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
            />
            {composedBody.length > VENDOR_INQUIRY_BODY_MAX_LENGTH && (
              <p className="mt-2 text-sm text-rose-600">
                {VENDOR_INQUIRY_BODY_MAX_LENGTH}文字以内で入力してください
              </p>
            )}

            {/* 画像添付 */}
            <div className="mt-4">
              {imagePreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200">
                  <Image
                    src={imagePreview}
                    alt="添付する画像"
                    width={640}
                    height={360}
                    unoptimized
                    className="h-44 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => handlePickImage(null)}
                    className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition hover:bg-black/70"
                    aria-label="画像を外す"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-4 text-sm font-semibold text-slate-500 transition hover:border-amber-300 hover:bg-amber-50/50">
                  <ImagePlus size={18} />
                  写真を添える（任意）
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePickImage(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
          </section>
        )}

        {/* 4. 急ぎ具合 */}
        {topic && (topic !== "report" || pattern) && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-700">どのくらい急ぎですか？</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {VENDOR_INQUIRY_URGENCIES.map((u) => {
                const meta = URGENCY_LABELS[u];
                const selected = urgency === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUrgency(u)}
                    aria-pressed={selected}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      selected
                        ? "border-amber-300 bg-amber-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/50"
                    }`}
                  >
                    <span className="block text-sm font-bold text-slate-900">{meta.label}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{meta.description}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {category && (
          <p className="px-1 text-sm text-slate-500">
            この連絡は <span className="font-semibold text-slate-700">{CATEGORY_LABELS[category]}</span> に届きます。
          </p>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex w-full items-center justify-center gap-2 rounded-3xl bg-amber-500 py-4 text-base font-bold text-white shadow transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isSending ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              送信しています...
            </>
          ) : (
            <>
              <Send size={18} />
              送信する
            </>
          )}
        </button>
      </div>
    </div>
  );
}
