"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Loader2, Send, CheckCircle2, AlertCircle, HelpCircle, Bug, MessageSquare, Mail, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const contactSchema = z.object({
  name: z.string().optional(),
  email: z.string()
    .min(1, "メールアドレスは必須です")
    .email("返信先として使用しますので、正確なメールアドレスを半角で入力してください（例: user@example.com）"),
  category: z.enum(["question", "feedback", "bug", "other"], {
    errorMap: () => ({ message: "カテゴリを選択してください" }),
  }),
  message: z.string().min(10, "内容は10文字以上で入力してください").max(1000, "内容は1000文字以内で入力してください"),
});

type ContactFormData = z.infer<typeof contactSchema>;

const CATEGORIES = [
  { id: "question", label: "ご質問", icon: HelpCircle, desc: "使い方やサービスについて" },
  { id: "feedback", label: "ご意見", icon: MessageSquare, desc: "機能のご要望や感想" },
  { id: "bug", label: "不具合・トラブル", icon: Bug, desc: "アプリの調子が悪いとき" },
  { id: "other", label: "その他", icon: Mail, desc: "取材やその他のご連絡" },
] as const;

export default function ContactForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      category: "question",
    },
  });

  const selectedCategory = watch("category");
  const emailValue = watch("email");

  // 全角文字を検出するヘルパー
  const hasFullWidthChars = (str?: string) => {
    if (!str) return false;
    return /[^\x01-\x7E]/.test(str);
  };

  // 全角→半角変換ハンドラー
  const handleFixEmail = () => {
    if (!emailValue) return;
    const fixed = emailValue.replace(/[！-～]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
    });
    setValue("email", fixed, { shouldValidate: true });
  };

  const onSubmit = async (data: ContactFormData) => {
    setSubmitError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setSubmitError(json.error ?? "送信に失敗しました。もう一度お試しください。");
        return;
      }
      setIsSubmitted(true);
    } catch {
      setSubmitError("通信エラーが発生しました。しばらくしてから再度お試しください。");
    }
  };

  if (isSubmitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center space-y-4 rounded-2xl border border-green-100 bg-white/80 p-8 text-center shadow-sm backdrop-blur-sm"
      >
        <div className="rounded-full bg-green-100 p-3">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">送信完了しました</h3>
        <p className="max-w-xs text-sm text-gray-600">
          お問い合わせありがとうございます。<br />
          内容を確認の上、担当者よりご連絡させていただきます。
        </p>
        <button
          type="button"
          onClick={() => setIsSubmitted(false)}
          className="mt-4 text-sm font-medium text-amber-600 hover:text-amber-700 underline underline-offset-4"
        >
          新しい問い合わせを送る
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Category Selection */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-gray-700">お問い合わせの種類</label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setValue("category", cat.id as ContactFormData["category"])}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-xl border p-3 text-center transition-all duration-200",
                  isSelected
                    ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm ring-1 ring-amber-500"
                    : "border-gray-200 bg-white text-gray-600 hover:border-amber-200 hover:bg-amber-50/50"
                )}
              >
                <Icon className={cn("h-5 w-5", isSelected ? "text-amber-600" : "text-gray-400")} />
                <span className="text-xs font-bold">{cat.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 ml-1">
          {CATEGORIES.find(c => c.id === selectedCategory)?.desc}
        </p>
      </div>

      {/* Inputs */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-semibold text-gray-700">
            お名前 <span className="text-xs font-normal text-gray-400">(任意)</span>
          </label>
          <input
            {...register("name")}
            id="name"
            type="text"
            placeholder="日曜 市子"
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-semibold text-gray-700">
            メールアドレス <span className="text-xs font-medium text-red-500">*</span>
          </label>
          <input
            {...register("email")}
            id="email"
            type="email"
            placeholder="info@nicchyo.com"
            className={cn(
              "w-full rounded-lg border bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2",
              errors.email
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-gray-200 focus:border-amber-400 focus:ring-amber-100"
            )}
          />
          {errors.email && (
            <div className="space-y-2">
              <p className="flex items-start gap-1 text-xs text-red-500">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{errors.email.message}</span>
              </p>

              {/* Smart Fix: 全角文字が含まれている場合の提案 */}
              {hasFullWidthChars(emailValue) && (
                <motion.button
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  type="button"
                  onClick={handleFixEmail}
                  className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  全角文字が含まれています。半角に変換しますか？
                </motion.button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="message" className="text-sm font-semibold text-gray-700">
            お問い合わせ内容 <span className="text-xs font-medium text-red-500">*</span>
          </label>
          <textarea
            {...register("message")}
            id="message"
            rows={5}
            placeholder="できるだけ詳しくご記入いただけると助かります。"
            className={cn(
              "w-full resize-none rounded-lg border bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:ring-2",
              errors.message
                ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                : "border-gray-200 focus:border-amber-400 focus:ring-amber-100"
            )}
          />
          {errors.message && (
            <p className="flex items-center gap-1 text-xs text-red-500">
              <AlertCircle className="h-3 w-3" />
              {errors.message.message}
            </p>
          )}
        </div>
      </div>

      {/* Submit Error */}
      {submitError && (
        <p className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {submitError}
        </p>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-orange-200 transition-all hover:shadow-lg hover:shadow-orange-300 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        )}
        {isSubmitting ? "送信中..." : "送信する"}
      </button>

      <p className="text-center text-xs text-gray-500">
        お問い合わせ内容は
        <Link href="/privacy" className="mx-1 font-medium text-amber-600 underline hover:text-amber-700">
          プライバシーポリシー
        </Link>
        に基づき管理されます。
      </p>
    </form>
  );
}
