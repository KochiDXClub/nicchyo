import type { Metadata } from "next";
import NavigationBar from "../../components/NavigationBar";

export const metadata: Metadata = {
  title: "ニュース | nicchyo 日曜市",
  description: "nicchyoからのお知らせ・日曜市の最新情報をまとめています。",
};

type NewsCategory = "お知らせ" | "アップデート" | "メンテナンス" | "イベント";

const categoryStyles: Record<NewsCategory, string> = {
  お知らせ: "bg-sky-50 text-sky-700",
  アップデート: "bg-emerald-50 text-emerald-700",
  メンテナンス: "bg-rose-50 text-rose-700",
  イベント: "bg-amber-50 text-amber-700",
};

type NewsItem = {
  id: string;
  category: NewsCategory;
  date: string;
  title: string;
  excerpt: string;
};

// レイアウト確認用のダミーデータ（実データ連携は別途対応）
const newsItems: NewsItem[] = [
  {
    id: "1",
    category: "お知らせ",
    date: "2026.06.22",
    title: "マップに新しいランドマークアイコンを追加しました",
    excerpt:
      "とさでん交通の停留場やJR高知駅などを丸型アイコンで表示できるようになりました。タップすると名称が確認できます。",
  },
  {
    id: "2",
    category: "アップデート",
    date: "2026.06.15",
    title: "マップ最大縮小時の表示を改善しました",
    excerpt:
      "日曜市全体の雰囲気が伝わるイラスト表示を追加し、最初に開いたときの見やすさを改善しました。",
  },
  {
    id: "3",
    category: "メンテナンス",
    date: "2026.06.01",
    title: "サーバーメンテナンスのお知らせ",
    excerpt:
      "より安定したサービス提供のため、深夜帯にメンテナンスを実施しました。ご不便をおかけし申し訳ございません。",
  },
  {
    id: "4",
    category: "イベント",
    date: "2026.05.20",
    title: "日曜市スタンプラリーを開催中です",
    excerpt: "マップを見ながらお店を巡って、スタンプを集めるとオリジナル特典がもらえます。",
  },
];

export default function NewsPage() {
  return (
    <main className="min-h-screen bg-[#FDFBF7] pb-24 text-gray-900">
      {/* Header Section */}
      <div className="bg-gradient-to-b from-sky-100/50 to-transparent pb-6 pt-safe-top">
        <div className="mx-auto flex max-w-lg flex-col px-4 pt-6">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">ニュース</h1>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              全{newsItems.length}件
            </span>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <p className="text-sm leading-relaxed text-gray-600">
              nicchyoからのお知らせ・アップデート情報・日曜市にまつわるイベント情報をお届けします。
            </p>
          </div>
        </div>
      </div>

      {/* News List */}
      <div className="mx-auto max-w-lg px-4">
        <div className="flex flex-col gap-3">
          {newsItems.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 transition active:scale-[0.99]"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyles[item.category]}`}
                >
                  {item.category}
                </span>
                <span className="text-xs font-medium text-gray-400">{item.date}</span>
              </div>
              <h2 className="mt-3 text-base font-bold leading-snug text-gray-900">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.excerpt}</p>
            </article>
          ))}
        </div>
      </div>

      <NavigationBar />
    </main>
  );
}
