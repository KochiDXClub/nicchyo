"use client";

import NavigationBar from "../../components/NavigationBar";

export default function UserPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-amber-50 via-orange-50 to-white text-gray-900">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 pt-4">
        {/* ユーザー情報 */}
        <section className="rounded-2xl border border-amber-100 bg-white/90 p-4 shadow-md">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-3xl">
              👤
            </div>
            <div>
              <p className="text-lg font-semibold">市場さん（仮）</p>
              <p className="text-sm text-gray-600">kochi_sunday@example.com</p>
              <p className="mt-1 text-xs text-gray-500">
                高知・日曜市をもっと楽しむためのマイページです。
              </p>
            </div>
          </div>
        </section>

        {/* お気に入りと最近の訪問 */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-100 bg-white/90 p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">お気に入り</h2>
            <p className="mt-1 text-sm text-gray-600">ブックマーク中の店舗やスポット。</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-800">
              <li>・土佐刃の匠</li>
              <li>・旬の野菜屋さん</li>
              <li>・藁焼きかつお屋</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-white/90 p-4 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900">最近の訪問</h2>
            <p className="mt-1 text-sm text-gray-600">過去の散策メモ。</p>
            <ul className="mt-3 space-y-2 text-sm text-gray-800">
              <li>・A: 野菜メインエリア</li>
              <li>・B: 伝統工芸エリア</li>
              <li>・C: おやつとお土産</li>
            </ul>
          </div>
        </section>

        {/* メモ・ことづて */}
        <section className="rounded-2xl border border-amber-100 bg-white/90 p-4 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">メモ・ことづて</h2>
          <p className="mt-1 text-sm text-gray-600">気になったことを覚えておこう。</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-800 shadow-sm">
              <p className="text-xs text-gray-500">2025/12/04</p>
              <p className="mt-1">かつおタタキが美味しい店を再訪したい。</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-800 shadow-sm">
              <p className="text-xs text-gray-500">2025/11/27</p>
              <p className="mt-1">焼き芋屋さんの行列がすごい。開店直後が狙い目。</p>
            </div>
          </div>
        </section>
      </main>

      <NavigationBar />
    </div>
  );
}
