"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Store } from "lucide-react";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { Badge, Button, buttonClass, CenteredLoading, PageContainer, PageShell, PageTitle, Surface } from "@/components/ui";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/utils/apiRequest";
import { SHOP_PERMISSION_META } from "@/lib/vendor/shopPermissions";
import { createClient } from "@/utils/supabase/client";
import { acceptJoin, previewJoin, type JoinKind, type JoinPreview } from "@/app/vendor/_services/joinService";

const COPY: Record<JoinKind, { title: string; lead: (shop: string) => string; action: string }> = {
  invite: {
    title: "お店に参加する",
    lead: (shop) => `「${shop}」の一員として参加します。`,
    action: "このお店に参加する",
  },
  claim: {
    title: "お店を登録する",
    lead: (shop) => `「${shop}」の代表者として、このアカウントを登録します。`,
    action: "代表者として登録する",
  },
};

type Step = "checking" | "ready" | "joining" | "done" | "done-relogin";

/**
 * 招待リンク（/join/<トークン>）と QR コード（/claim/<トークン>）で店舗に参加する画面。
 * ログイン前でも、どのお店かを見せる → Google でログイン → 参加する、の順に進む。
 * 参加すると出店者ロールが付くので、ログインの情報（トークン）を作り直してから、マイ店舗へ移る。
 */
export default function JoinShopFlow({ kind, token }: { kind: JoinKind; token: string }) {
  const { user, isLoading } = useAuth();
  const copy = COPY[kind];
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("checking");
  const [error, setError] = useState<{ message: string; alreadyMember: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewJoin(kind, token)
      .then((result) => {
        if (cancelled) return;
        setPreview(result);
        setStep("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setPreviewError(e instanceof Error ? e.message : "リンクを確かめられませんでした。");
        setStep("ready");
      });
    return () => {
      cancelled = true;
    };
  }, [kind, token]);

  const handleJoin = async () => {
    setError(null);
    setStep("joining");
    try {
      await acceptJoin(kind, token);
    } catch (e) {
      const apiError = e instanceof ApiError ? e : null;
      // QR は使用済みになっているので、ロールの付与だけ失敗したときは、ログインし直しで完了する
      if (apiError?.code === "role_failed") {
        setStep("done-relogin");
        return;
      }
      setError({ message: apiError?.message ?? "参加できませんでした。もう一度お試しください。", alreadyMember: apiError?.code === "already_member" });
      setStep("ready");
      return;
    }

    // 参加した時点で出店者ロールが付いたので、ログインの情報を作り直してから移る
    // （作り直さないと、移った先で出店者として扱われない）
    const { error: refreshError } = await createClient().auth.refreshSession();
    if (refreshError) {
      setStep("done-relogin");
      return;
    }
    setStep("done");
    window.location.assign("/my-shop");
  };

  const unavailable = previewError ?? (preview?.status === "unavailable" ? preview.message : null);

  return (
    <PageShell bottomNav={false}>
      <PageTitle title={copy.title} />
      <PageContainer className="space-y-4">
        {step === "checking" || isLoading ? (
          <CenteredLoading />
        ) : unavailable ? (
          <Surface elevation="lifted" padding="lg" className="space-y-4 text-center">
            <p className="text-[15px] leading-relaxed text-nicchyo-ink">{unavailable}</p>
            <Link href="/" className={buttonClass({ variant: "secondary" })}>
              トップへ戻る
            </Link>
          </Surface>
        ) : preview?.status === "ok" ? (
          <Surface elevation="lifted" padding="lg" className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-chip bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                <Store size={20} aria-hidden />
              </span>
              <p className="text-[15px] leading-relaxed text-nicchyo-ink">{copy.lead(preview.shopName)}</p>
            </div>

            {kind === "invite" && (
              <div>
                <p className="text-xs font-semibold text-nicchyo-ink/55">できること</p>
                {preview.permissions.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {preview.permissions.map((permission) => (
                      <li key={permission}>
                        <Badge variant="amber">{SHOP_PERMISSION_META[permission].label}</Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-nicchyo-ink/70">お店の情報を見ることができます。</p>
                )}
                <p className="mt-2 text-xs text-nicchyo-ink/55">できることは、あとから代表者が変えられます。</p>
              </div>
            )}

            {step === "done" || step === "done-relogin" ? (
              <div className="space-y-3 text-center">
                <CheckCircle2 className="mx-auto text-status-good-fg" size={32} aria-hidden />
                <p className="text-[15px] font-semibold text-nicchyo-ink">
                  {step === "done" ? "参加できました。マイ店舗へ移ります…" : "参加できました。"}
                </p>
                {step === "done-relogin" && (
                  <>
                    <p className="text-sm leading-relaxed text-nicchyo-ink/70">
                      あと少しです。いちどログアウトして、もう一度Googleでログインしてください。
                    </p>
                    <Link href="/login" className={buttonClass({ variant: "primary" })}>
                      ログイン画面へ
                    </Link>
                  </>
                )}
              </div>
            ) : !user ? (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-nicchyo-ink/70">
                  参加するには、Googleアカウントでログインしてください。ログインしたら、このページに戻ります。
                </p>
                <GoogleSignInButton onError={(message) => setError({ message, alreadyMember: false })} />
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-nicchyo-ink/70">
                  ログイン中のアカウント: <span className="font-semibold text-nicchyo-ink">{user.email || user.name}</span>
                </p>
                <Button size="lg" className="w-full" onClick={handleJoin} disabled={step === "joining"}>
                  {step === "joining" ? "参加しています…" : copy.action}
                </Button>
              </div>
            )}

            {error && (
              <div role="alert" className="space-y-2 rounded-btn bg-status-critical-bg p-3 text-sm text-status-critical-fg ring-1 ring-status-critical-line">
                <p>{error.message}</p>
                {error.alreadyMember && (
                  <Link href="/my-shop" className="font-semibold underline">
                    マイ店舗を開く
                  </Link>
                )}
              </div>
            )}
          </Surface>
        ) : null}
      </PageContainer>
    </PageShell>
  );
}
