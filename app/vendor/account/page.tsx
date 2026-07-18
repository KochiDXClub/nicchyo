"use client";

export const dynamic = "force-dynamic";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Loader2,
  User,
  Mail,
  Lock,
  LogOut,
  AlertTriangle,
  Eye,
  EyeOff,
  Construction,
  Phone,
  Trash2,
} from "lucide-react";

// TODO: 現在、出店者のメールアドレス・パスワードが一部公開状態のため
//       プロフィール・パスワード変更・アカウント削除は一時的に無効化しています。
//       セキュリティ対応（RLS・認証フロー整備）完了後に false へ変更してください。
const SAVE_DISABLED = true;

function SectionHeader({ icon: Icon, title }: { icon: typeof User; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
        <Icon size={14} />
      </div>
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
    </div>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 pr-10 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function VendorAccountPage() {
  const { user, updateProfile, logout } = useAuth();
  const router = useRouter();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProfileSaved, setIsProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isPasswordSaved, setIsPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    if (SAVE_DISABLED || isSavingProfile || !user) return;
    setIsSavingProfile(true);
    setProfileError(null);
    try {
      await updateProfile({ name: name.trim(), email: email.trim(), phone: phone.trim(), avatarUrl: user.avatarUrl });
      setIsProfileSaved(true);
      setTimeout(() => setIsProfileSaved(false), 3000);
    } catch {
      setProfileError("保存に失敗しました。もう一度お試しください。");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (SAVE_DISABLED || isSavingPassword) return;
    if (newPassword.length < 8) {
      setPasswordError("パスワードは8文字以上で設定してください。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("パスワードが一致しません。");
      return;
    }
    setIsSavingPassword(true);
    setPasswordError(null);
    try {
      const { createClient } = await import("@/utils/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordSaved(true);
      setTimeout(() => setIsPasswordSaved(false), 3000);
    } catch {
      setPasswordError("パスワードの変更に失敗しました。もう一度お試しください。");
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    if (SAVE_DISABLED || isDeletingAccount) return;
    setIsDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/vendor/account/delete", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "削除に失敗しました");
      }
      await logout();
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "削除に失敗しました。もう一度お試しください。");
      setIsDeletingAccount(false);
    }
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    await logout();
    router.push("/login");
  }

  const deleteConfirmEmail = user?.email ?? "";
  const isDeleteReady = deleteConfirm === deleteConfirmEmail;

  return (
    <div className="min-h-screen bg-[#FFFAF0] pb-24">
      <div className="border-b border-amber-100 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/my-shop"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-600">Account</p>
            <h1 className="text-xl font-bold text-slate-900">アカウント設定</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-5">
        <div className="rounded-3xl border border-amber-100 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Account</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">アカウント設定</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            名前や連絡先は見やすく、ログアウトはすぐ押せるようにしています。危険な操作は下の方にまとめています。
          </p>
        </div>

        {/* 一時停止バナー */}
        {SAVE_DISABLED && (
          <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Construction size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
            <div>
              <p className="text-base font-semibold text-amber-800">変更機能は現在準備中です</p>
              <p className="mt-0.5 text-sm text-amber-700">
                セキュリティ対応の完了後に有効化予定です。ログアウトは引き続き使用できます。
              </p>
            </div>
          </div>
        )}

        {/* プロフィール */}
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <SectionHeader icon={User} title="名前" />
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：山田 太郎"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <SectionHeader icon={Mail} title="メールアドレス" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="例：example@email.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <SectionHeader icon={Phone} title="電話番号（任意）" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="例：090-1234-5678"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-amber-300"
            />
            <p className="mt-1.5 text-[10px] text-slate-400">
              公開されません。運営からの連絡用に使用します。
            </p>
          </div>

          {profileError && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
              {profileError}
            </div>
          )}

          <button
            type="submit"
            disabled={SAVE_DISABLED || isSavingProfile}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold shadow transition ${
              SAVE_DISABLED || isSavingProfile
                ? "cursor-not-allowed bg-slate-200 text-slate-400"
                : isProfileSaved
                ? "bg-emerald-500 text-white"
                : "bg-amber-500 text-white hover:bg-amber-400"
            }`}
          >
            {isSavingProfile ? (
              <><Loader2 size={18} className="animate-spin" />保存中...</>
            ) : isProfileSaved ? (
              <><CheckCircle2 size={18} />保存しました！</>
            ) : (
              <><Save size={18} />プロフィールを保存</>
            )}
          </button>
        </form>

        {/* パスワード変更：Googleログインユーザーには非表示 */}
        {user?.provider === "google" ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <SectionHeader icon={Lock} title="パスワード変更" />
            <p className="text-xs text-slate-500">
              Googleアカウントでログインしているため、パスワードはGoogle側で管理されています。
              変更する場合は
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-blue-600 underline underline-offset-2"
              >
                Googleアカウント設定
              </a>
              から行ってください。
            </p>
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <SectionHeader icon={Lock} title="パスワード変更" />
              <div className="space-y-2">
                <PasswordInput
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="新しいパスワード（8文字以上）"
                />
                <PasswordInput
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="新しいパスワード（確認）"
                />
              </div>
            </div>

            {passwordError && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              disabled={SAVE_DISABLED || isSavingPassword || (!newPassword && !confirmPassword)}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold shadow transition ${
                SAVE_DISABLED || isSavingPassword || (!newPassword && !confirmPassword)
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : isPasswordSaved
                  ? "bg-emerald-500 text-white"
                  : "bg-amber-500 text-white hover:bg-amber-400"
              }`}
            >
              {isSavingPassword ? (
                <><Loader2 size={18} className="animate-spin" />変更中...</>
              ) : isPasswordSaved ? (
                <><CheckCircle2 size={18} />変更しました！</>
              ) : (
                <><Lock size={18} />パスワードを変更する</>
              )}
            </button>
          </form>
        )}

        {/* ログアウト */}
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={LogOut} title="ログアウト" />
          <p className="mb-3 text-xs text-slate-500">
            ログアウトすると出店者メニューにアクセスできなくなります
          </p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 bg-rose-50 py-3 text-base font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoggingOut ? (
              <><Loader2 size={16} className="animate-spin" />ログアウト中...</>
            ) : (
              <><LogOut size={16} />ログアウト</>
            )}
          </button>
        </div>

        {/* アカウント削除 */}
        <div className="rounded-3xl border border-rose-200 bg-white p-4 shadow-sm">
          <SectionHeader icon={Trash2} title="アカウント削除" />
          <p className="mb-3 text-xs text-slate-500">
            アカウントを削除すると、すべてのデータが完全に失われます。この操作は取り消せません。
          </p>
          {SAVE_DISABLED ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-400">
              現在準備中です。セキュリティ対応完了後に有効化されます。
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium text-slate-600">
                確認のため、メールアドレス（<span className="font-semibold">{deleteConfirmEmail}</span>）を入力してください
              </p>
              <input
                type="email"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={deleteConfirmEmail}
                className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-300"
              />
              {deleteError && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  {deleteError}
                </div>
              )}
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={!isDeleteReady || isDeletingAccount}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-rose-300 bg-rose-50 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isDeletingAccount ? (
                  <><Loader2 size={16} className="animate-spin" />削除中...</>
                ) : (
                  <><Trash2 size={16} />アカウントを削除する</>
                )}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
