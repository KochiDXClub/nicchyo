"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import NavigationBar from "../../components/NavigationBar";
import { useAuth } from "../../../lib/auth/AuthContext";

type StatusState = "idle" | "saved";

export default function MyProfilePage() {
  const { isLoggedIn, user, updateProfile, logout } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState("");
  const [status, setStatus] = useState<StatusState>("idle");

  useEffect(() => {
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user) return "未ログイン";
    if (user.role === "admin") return "管理者";
    if (user.role === "vendor") return "出店者";
    return "一般ユーザー";
  }, [user]);

  const isDirty =
    !!user &&
    (name.trim() !== user.name ||
      email.trim() !== user.email ||
      (avatarUrl ?? "") !== (user.avatarUrl ?? ""));
  const canSave = !!user && name.trim() && email.trim();

  const handleSave = async () => {
    if (!canSave || !user) return;
    await updateProfile({
      name: name.trim(),
      email: email.trim(),
      avatarUrl: avatarUrl ?? undefined,
    });
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 2000);
  };

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("2MB以下の画像を選択してください。");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarClear = () => {
    setAvatarUrl(null);
    setAvatarError("");
  };

  if (!isLoggedIn || !user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white text-gray-900 pb-16 pt-4">
        <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-6">
          <div className="rounded-2xl border border-amber-100 bg-white/95 px-6 py-5 text-center shadow-sm">
            <p className="text-base font-semibold uppercase tracking-[0.14em] text-amber-700">
              My profile
            </p>
            <h1 className="mt-1 text-4xl font-bold text-gray-900">プロフィール</h1>
            <p className="mt-1 text-xl text-gray-700">
              プロフィールの確認・編集にはログインが必要です。
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-amber-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500"
          >
            ログインへ
          </Link>
        </div>
        <NavigationBar />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50 to-white text-gray-900 pb-20 pt-4">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
        <div className="rounded-2xl border border-amber-100 bg-white/95 px-6 py-5 text-center shadow-sm">
          <p className="text-base font-semibold uppercase tracking-[0.14em] text-amber-700">
            My Profile
          </p>
          <h1 className="mt-1 text-4xl font-bold text-gray-900">プロフィール</h1>
          <p className="mt-1 text-xl text-gray-700">
            アカウント情報の確認・変更ができます。
          </p>
        </div>
        <div className="flex justify-center">
          <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">
            {roleLabel}
          </span>
        </div>
      </div>

      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-4">
        <section className="rounded-3xl border border-orange-100 bg-white/95 p-6 shadow-sm">
          <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-8">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-amber-500 text-2xl font-bold text-white shadow-sm">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="プロフィール画像" width={80} height={80} className="h-full w-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
              <p className="text-sm text-gray-600">{user.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100">
                  アイコンを変更
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleAvatarClear}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm transition hover:bg-gray-50"
                  >
                    画像を削除
                  </button>
                )}
              </div>
              {avatarError && <p className="mt-2 text-xs text-rose-600">{avatarError}</p>}
              <p className="mt-2 text-xs text-gray-500">2MB以下の画像をアップロードできます。</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-orange-100 bg-white/95 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">基本情報</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              お名前
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-amber-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              メールアドレス
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-amber-400 focus:outline-none"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || !isDirty}
              className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-amber-300"
            >
              変更を保存
            </button>
            {status === "saved" && <span className="text-xs text-amber-700">保存しました。</span>}
          </div>
        </section>

        <section className="rounded-3xl border border-orange-100 bg-white/95 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">セキュリティ</h3>
          <p className="mt-2 text-sm text-gray-700">パスワード変更はログイン画面から行えます。</p>
          <div className="mt-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              パスワードを変更する
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-orange-100 bg-white/95 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900">ログアウト</h3>
          <p className="mt-2 text-sm text-gray-700">使わないときはログアウトをおすすめします。</p>
          <div className="mt-3">
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
            >
              ログアウト
            </button>
          </div>
        </section>
      </div>
      <NavigationBar />
    </main>
  );
}
