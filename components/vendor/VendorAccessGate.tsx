"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { requiredPermissionForPath } from "./vendorNavItems";

type Cta = { href: string; label: string };

function GuardMessage({
  kicker,
  title,
  message,
  cta,
  onRetry,
}: {
  kicker: string;
  title: string;
  message: string;
  cta?: Cta;
  onRetry?: () => void;
}) {
  const ctaClass =
    "mt-6 inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-amber-400";
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="text-base font-semibold uppercase tracking-[0.3em] text-amber-700">{kicker}</p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-lg text-slate-600">{message}</p>
        {cta && (
          <Link href={cta.href} className={ctaClass}>
            {cta.label}
          </Link>
        )}
        {onRetry && (
          <button type="button" onClick={onRetry} className={ctaClass}>
            もう一度読み込む
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * 出店者向けの画面（/vendor/**・/my-shop/**）の入口。次を順に確かめ、通ったときだけ中身を出す。
 *   読み込み中 → ログイン → 出店者ロール → 所属店舗（引けなかったときは「もう一度」）→ 画面ごとの権限
 * 「引けなかった」と「店舗に入っていない」は分けて出す。一時的な通信の失敗で、代表者に
 * 「招待リンクで参加してください」と出さないため。
 * 権限は、導線を隠すだけでなく、URL を直接開かれたときにも案内する（読み書きは RLS が止める）。
 */
export default function VendorAccessGate({ kicker, children }: { kicker: string; children: ReactNode }) {
  const { user, permissions, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return (
      <GuardMessage
        kicker={kicker}
        title="読み込み中です"
        message="ログイン状態を確認しています。しばらくお待ちください。"
      />
    );
  }

  if (!user) {
    return (
      <GuardMessage
        kicker={kicker}
        title="ログインしてください"
        message="出店者専用ページです。ログインしてからご利用ください。"
        cta={{ href: "/login", label: "ログインへ" }}
      />
    );
  }

  if (!permissions.isVendor) {
    return (
      <GuardMessage
        kicker={kicker}
        title="出店者専用です"
        message="出店者ロールのアカウントでログインしてください。"
        cta={{ href: "/", label: "トップへ戻る" }}
      />
    );
  }

  if (user.shopMembershipLookupFailed) {
    return (
      <GuardMessage
        kicker={kicker}
        title="読み込めませんでした"
        message="お店の情報を読み込めませんでした。電波の良いところで、もう一度お試しください。"
        onRetry={() => window.location.reload()}
      />
    );
  }

  // 出店者ロールでも、店舗に入っていなければ使える画面がない（招待リンクかQRでの参加を案内する）
  if (!user.vendorId) {
    return (
      <GuardMessage
        kicker={kicker}
        title="お店に参加していません"
        message="お店の代表者からもらった招待リンク、または運営から渡されたQRコードで参加してください。"
        cta={{ href: "/", label: "トップへ戻る" }}
      />
    );
  }

  const required = requiredPermissionForPath(pathname);
  if (required && !permissions.canShop(required)) {
    return (
      <GuardMessage
        kicker={kicker}
        title="この画面を使う権限がありません"
        message="お店の代表者に、この操作の権限をつけてもらってください。"
        cta={{ href: "/my-shop", label: "マイ店舗へ戻る" }}
      />
    );
  }

  return <>{children}</>;
}
