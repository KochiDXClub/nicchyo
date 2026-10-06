"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, useRef } from "react";
import Image from "next/image";
import { useAuth } from "../../../lib/auth/AuthContext";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import NavigationBar from "../../components/NavigationBar";
import { Mail, Lock, LogIn, ChevronRight, UserPlus, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { loginWithCredentials } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    const loggedInUser = await loginWithCredentials(identifier, password);
    setIsSubmitting(false);

    if (!loggedInUser) {
      setError("ログインできませんでした。メールアドレスやパスワードにお間違いがないか確認してください。");
      return;
    }
    const destination =
      loggedInUser.role === "vendor"
        ? "/my-shop"
        : loggedInUser.role === "admin"
          ? "/admin/dashboard"
          : "/map";
    router.push(destination);
  };

  return (
    <div className="min-h-screen bg-orange-50/50 pb-24 font-sans text-slate-800">
      {/* Background decoration */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100/50 via-transparent to-transparent pointer-events-none" />

      <div className="mx-auto flex w-full max-w-lg flex-col items-center px-4 pt-8 md:pt-16">

        {/* Header Section with friendly greeting */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-6 relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-orange-100 shadow-md">
             <Image
              src="/images/obaasan.webp"
              alt="Obaasan"
              fill
              className="object-cover"
              sizes="96px"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            日曜市へ、おかえりなさい。
          </h1>
          <p className="mt-3 max-w-xs text-sm text-slate-600 leading-relaxed">
            ログインすると、お買い物リストを共有したり、<br/>
            あなただけのお気に入り機能が使えます。
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full rounded-[2rem] border border-white/60 bg-white/80 p-6 shadow-xl shadow-orange-100/50 backdrop-blur-xl md:p-8">

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="group">
                <label className="mb-1.5 block text-xs font-bold text-slate-500 ml-1">
                  メールアドレス
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-orange-400 group-focus-within:text-orange-500 transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    ref={emailInputRef}
                    type="email"
                    required
                    placeholder="example@domain.com"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    className="block w-full rounded-2xl border-0 bg-orange-50/50 py-3.5 pl-10 pr-4 text-slate-900 ring-1 ring-inset ring-orange-100 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-orange-400 transition-all duration-200"
                  />
                </div>
              </div>

              <div className="group">
                <label className="mb-1.5 block text-xs font-bold text-slate-500 ml-1">
                  パスワード
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-orange-400 group-focus-within:text-orange-500 transition-colors">
                    <Lock size={18} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="block w-full rounded-2xl border-0 bg-orange-50/50 py-3.5 pl-10 pr-12 text-slate-900 ring-1 ring-inset ring-orange-100 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-inset focus:ring-orange-400 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {error.includes("ログインできません") && (
                  <button
                    type="button"
                    onClick={() => {
                      emailInputRef.current?.focus();
                    }}
                    className="self-end text-xs font-bold text-rose-700 underline decoration-rose-300 underline-offset-4 hover:decoration-rose-700"
                  >
                    入力欄を確認する
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition-all duration-200 hover:from-orange-600 hover:to-amber-600 hover:shadow-orange-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isSubmitting ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <span>ログインして始める</span>
                  <LogIn size={18} className="transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white/80 px-2 text-slate-400">または</span>
              </div>
            </div>

            <GoogleSignInButton redirectPath="/map" onStart={() => setError("")} onError={setError} className="mt-6" />
          </div>

        </div>

        {/* Footer Links */}
        <div className="mt-8 flex flex-col items-center space-y-4">
          <Link
            href="/signup"
            className="group flex items-center gap-1 rounded-full bg-white/60 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-white hover:text-orange-600"
          >
            <UserPlus size={16} className="text-slate-400 group-hover:text-orange-500" />
            <span>初めての方は アカウント登録</span>
            <ChevronRight size={14} className="opacity-50 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <Link
            href="/"
            className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            ホームに戻る
          </Link>
        </div>

      </div>
      <NavigationBar />
    </div>
  );
}
