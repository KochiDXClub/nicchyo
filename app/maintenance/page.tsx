import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "メンテナンス中 | nicchyo",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<{ msg?: string }>;
}

export default async function MaintenancePage({ searchParams }: Props) {
  const { msg } = await searchParams;
  const message = msg?.trim() || "現在システムメンテナンスのためサービスを一時停止しています。\nしばらくしてからもう一度アクセスしてください。";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-nicchyo-base px-4 text-center">
      <span className="text-6xl" aria-hidden="true">🔧</span>
      <h1 className="mt-6 font-display text-3xl font-bold text-nicchyo-ink">
        メンテナンス中
      </h1>
      <p className="mt-4 max-w-md whitespace-pre-wrap text-sm leading-relaxed text-nicchyo-ink/70">
        {message}
      </p>
      <p className="mt-8 text-xs text-nicchyo-ink/40">nicchyo – 日曜市デジタルマップ</p>
    </main>
  );
}
