"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { getSmartNamePlaceholder } from "./signup-logic";
import TurnstileWidget from "../../components/TurnstileWidget";
import { createClient } from "@/utils/supabase/client";
import { ShoppingBag, ArrowRight, Home, CheckCircle2 } from "lucide-react";
import NavigationBar from "../../components/NavigationBar";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [namePlaceholder] = useState(() =>
    typeof navigator === "undefined"
      ? "日曜 太郎"
      : getSmartNamePlaceholder(new Date(), navigator.language)
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const hasCaptcha = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("ユーザー名を入力してください。");
      return;
    }
    if (!email.trim()) {
      setError("メールアドレスを入力してください。");
      return;
    }
    if (!password) {
      setError("パスワードを入力してください。");
      return;
    }
    if (password !== passwordConfirm) {
      setError("パスワードが一致しません。");
      return;
    }
    if (hasCaptcha && !captchaToken) {
      setError("認証を完了してください。");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          name: name.trim(),
          role: "general_user",
        },
        captchaToken: hasCaptcha ? captchaToken : undefined,
      },
    });
    setIsSubmitting(false);

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? "アカウントを作成できませんでした。");
      return;
    }

    router.push("/map");
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-safe-bottom">
      {/* Navbar placeholder / Home Link */}
      <div className="flex h-14 items-center px-4">
        <Link href="/" className="flex items-center text-slate-500 hover:text-amber-600 transition-colors">
          <Home className="mr-1 h-5 w-5" />
          <span className="text-sm font-medium">ホームへ戻る</span>
        </Link>
      </div>

      <div className="mx-auto w-full max-w-lg px-6 pt-6 pb-20">
        {/* Header Section */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 ring-8 ring-amber-50">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            アカウント登録
          </h1>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            日曜市へようこそ。<br />
            アカウントを作ると、作ったお買い物リストを保存したり、<br className="hidden sm:inline" />家族と共有したりできるようになります。
          </p>
        </div>

        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                お名前（ニックネーム）
              </label>
              <input
                type="text"
                required
                autoComplete="nickname"
                placeholder={namePlaceholder}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="example@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                パスワード
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="8文字以上"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                パスワード（確認）
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="もう一度入力してください"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 flex items-start gap-2">
                <div className="mt-0.5 min-w-[16px] text-rose-600">⚠️</div>
                <p className="text-sm font-medium text-rose-700">
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-6 py-3.5 text-base font-bold text-white shadow-lg shadow-amber-500/30 transition-all hover:bg-amber-600 hover:shadow-amber-600/30 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-amber-300 disabled:shadow-none disabled:translate-y-0"
            >
              {isSubmitting ? (
                "登録中..."
              ) : (
                <>
                  登録してはじめる
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          {hasCaptcha && (
            <div className="mt-6 flex items-center justify-center">
              <TurnstileWidget
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken("")}
                onError={() => setCaptchaToken("")}
                className="flex items-center justify-center"
              />
            </div>
          )}
        </div>

        {/* Footer Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-slate-600">
            すでにアカウントをお持ちの方
          </p>
          <Link
            href="/login"
            className="mt-2 inline-flex items-center gap-1.5 text-base font-semibold text-amber-600 hover:text-amber-700 transition-colors"
          >
            ログインする
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Trust indicator (Optional but adds 'Anshin') */}
        <div className="mt-12 flex justify-center gap-6 text-slate-400 opacity-60">
           <div className="flex items-center gap-1.5">
             <CheckCircle2 className="h-4 w-4" />
             <span className="text-xs font-medium">SSL暗号化通信</span>
           </div>
           <div className="flex items-center gap-1.5">
             <CheckCircle2 className="h-4 w-4" />
             <span className="text-xs font-medium">リスト保護</span>
           </div>
        </div>
      </div>
      <NavigationBar />
    </div>
  );
}
