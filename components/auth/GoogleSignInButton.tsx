"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils/cn";

/**
 * 「Googleでログイン」ボタン。ログインページと、招待リンク・QR の参加ページで同じものを使う。
 *
 * ロゴの4色（#FFC107・#FF3D00・#4CAF50・#1976D2）は Google の規定色なので、トークンではなく直接書く（デザインシステムの「生の hex」の例外）。
 *
 * ログイン後に戻る場所（redirectPath）は、サイトの中のパス。省くと今開いているページに戻る
 * （参加ページで、ログインのあとそのまま参加の確認に続けるため）。
 * Supabase の Redirect URLs に、戻り先のパス（/join/**・/claim/** など）が許可されている必要がある。
 */
export default function GoogleSignInButton({
  redirectPath,
  onStart,
  onError,
  className,
}: {
  redirectPath?: string;
  /** 押した直後（前の失敗の表示を消すときなどに使う） */
  onStart?: () => void;
  /** 失敗したとき、画面に出す文言を受け取る */
  onError?: (message: string) => void;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    onStart?.();
    setPending(true);
    const origin = window.location.origin;
    const path = redirectPath ?? `${window.location.pathname}${window.location.search}`;
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${origin}${path}` },
    });
    // 成功すると Google の画面へ移るので、戻ってくるのは失敗したときだけ
    if (error) {
      setPending(false);
      onError?.("Googleログインに失敗しました。");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-full border border-line bg-white px-6 py-3 text-sm font-bold text-nicchyo-ink/70 shadow-sm transition-all hover:bg-nicchyo-base disabled:opacity-60",
        className,
      )}
    >
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303C33.62 32.91 29.168 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.53 16.011 19.002 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.344 4.342-17.694 10.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.127 0 9.91-1.972 13.477-5.182l-6.222-5.255C29.191 35.091 26.715 36 24 36c-5.147 0-9.586-3.06-11.282-7.477l-6.522 5.02C9.505 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303c-1.09 2.76-3.16 5.092-5.848 6.563l.003-.002 6.222 5.255C35.184 40.255 44 36 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
      Googleでログイン
    </button>
  );
}
