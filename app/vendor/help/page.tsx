import Link from "next/link";
import { ArrowLeft, Megaphone, Store, BarChart2, Sparkles, User, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

const GUIDE_SECTIONS = [
  {
    icon: Megaphone,
    color: "bg-amber-100 text-amber-600",
    title: "最新情報の投稿",
    href: "/vendor/post/new",
    description: "今日のおすすめ商品・残り数量・出店場所の変更など、お客さんに伝えたい情報をリアルタイムで発信できます。",
    tips: [
      "投稿には期限を設定できます（1時間・本日・カスタム日時）",
      "期限が切れた投稿は自動で非表示になります",
      "過去の投稿は「投稿履歴」からそのまま再投稿できます",
      "画像を添付すると目を引きやすくなります",
    ],
  },
  {
    icon: Store,
    color: "bg-emerald-100 text-emerald-600",
    title: "店舗情報の更新",
    href: "/vendor/store",
    description: "商品ラインナップ・価格・決済方法・出店予定日・営業時間・SNSリンクを管理します。",
    tips: [
      "商品と価格を登録するとマップ上で表示されます",
      "出店予定日を設定するとお客さんが来店計画を立てやすくなります",
      "決済方法（現金・カード・PayPayなど）は必ず設定しましょう",
      "InstagramやXのリンクを追加すると集客につながります",
    ],
  },
  {
    icon: BarChart2,
    color: "bg-violet-100 text-violet-600",
    title: "お店の分析",
    href: "/vendor/analytics",
    description: "店舗の閲覧数・クリック数を先週と比較できます。時間帯別・商品別の分析も確認できます。",
    tips: [
      "閲覧数が多い時間帯に合わせて投稿するのが効果的です",
      "商品分析では販売数量を自分で入力して管理できます",
      "AIばあちゃんに何回紹介されたかも確認できます",
      "データは毎日更新されます",
    ],
  },
  {
    icon: Sparkles,
    color: "bg-rose-100 text-rose-600",
    title: "AIばあちゃんに教える",
    href: "/vendor/ai-knowledge",
    description: "お店のこだわり・おすすめの食べ方・よくある質問への回答などを自由に書くと、AIばあちゃんがお客さんに紹介してくれます。",
    tips: [
      "詳しく書くほどAIの紹介精度が上がります",
      "「午前中が一番おいしい」「試食できます」など具体的な情報が効果的です",
      "内容はいつでも更新できます",
      "保存後にAIが自動で学習します（数分かかる場合があります）",
    ],
  },
  {
    icon: User,
    color: "bg-slate-100 text-slate-600",
    title: "アカウント設定",
    href: "/vendor/account",
    description: "名前・メールアドレス・パスワードの変更ができます。",
    tips: [
      "表示名はお客さんには見えません",
      "Googleログインの場合、パスワード変更はGoogleアカウント側で行います",
    ],
  },
];

export default function VendorHelpPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.16),_rgba(255,250,240,0))] pb-24">
      {/* ヘッダー */}
      <div className="border-b border-amber-100/80 bg-white/90 px-4 py-4 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            href="/my-shop"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <ArrowLeft size={19} />
          </Link>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600">Help Guide</p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">使い方ガイド</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 px-4 pt-5">
        <div className="rounded-[28px] border border-amber-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Overview</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">まずはここを見れば大丈夫です</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                使う頻度の高い機能を上から順に並べています。文字は大きめ、カードは押しやすくしています。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:w-[240px]">
              <div className="rounded-2xl bg-amber-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-amber-700">おすすめ</p>
                <p className="mt-1 text-sm font-bold text-amber-900">最新情報の投稿</p>
              </div>
              <div className="rounded-2xl bg-emerald-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-emerald-700">基本設定</p>
                <p className="mt-1 text-sm font-bold text-emerald-900">店舗情報の更新</p>
              </div>
              <div className="rounded-2xl bg-violet-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-violet-700">見やすい</p>
                <p className="mt-1 text-sm font-bold text-violet-900">お店の分析</p>
              </div>
              <div className="rounded-2xl bg-rose-50 px-3 py-3">
                <p className="text-[11px] font-semibold text-rose-700">AI活用</p>
                <p className="mt-1 text-sm font-bold text-rose-900">AIばあちゃんに教える</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {/* 各セクション */}
          {GUIDE_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.href} className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <Link href={section.href} className="flex items-start gap-4 px-4 py-4 transition hover:bg-slate-50 md:px-5">
                <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${section.color}`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-bold text-slate-800 md:text-lg">{section.title}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">開く</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500 md:text-base">{section.description}</p>
                </div>
                <ChevronRight size={18} className="mt-1 flex-shrink-0 text-slate-300" />
              </Link>

              <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 md:px-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">使うときのポイント</p>
                <ul className="grid gap-2 md:grid-cols-2">
                  {section.tips.map((tip) => (
                    <li key={tip} className="flex items-start gap-2 rounded-2xl bg-white px-3 py-3 text-sm leading-relaxed text-slate-600 shadow-sm">
                      <span className="mt-0.5 flex-shrink-0 text-amber-400">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
        </div>
      </div>

    </div>
  );
}
