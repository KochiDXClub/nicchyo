/**
 * 「準備中」の表示。ページ公開設定で「準備中」にしたページ（/preparing へ差し替え）と、
 * 本番でマップを見られない人が開くトップで使う。
 */
export default function PreparingNotice() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-nicchyo-base px-4 text-center">
      <span className="text-6xl" aria-hidden="true">🌱</span>
      <h1 className="mt-6 font-display text-3xl font-bold text-nicchyo-ink">ただいま準備中です</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-nicchyo-ink/70">
        日曜市マップは、2027年のリリースを目指して準備しています。
        <br />
        公開まで、もうしばらくお待ちください。
      </p>
      <a href="/login" className="mt-8 text-xs text-nicchyo-ink/55 underline underline-offset-2">
        管理者の方はログイン
      </a>
      <p className="mt-8 text-xs text-nicchyo-ink/40">nicchyo – 日曜市デジタルマップ</p>
    </main>
  );
}
