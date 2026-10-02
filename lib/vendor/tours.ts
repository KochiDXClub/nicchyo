/**
 * 出店者の画面ごとの説明パネル（右上の「?」から何度でも見られる。初めて開いた画面では自動で出る）。
 *
 * 構成は 画面（ページ）→ 機能 → スライド。
 * - 右上の「?」は、その画面にある機能の説明を順に見せる。
 * - 機能ごとの小さな「?」（FeatureHelpButton）は、その機能の説明だけを開く。
 * - 「見た」の記録は機能ごと（vendor_tour_seen.tour_key = 機能の key）。機能を足したときは、
 *   その機能の分だけが自動で出て、すでに見た機能は出ない。
 *
 * 各スライドは「動くデモ」を1つ持つ。デモの絵と動きは components/vendor/tour/demo/ にあり、
 * ここには見出し・本文と、デモの工程ごとの字幕（captions）だけを書く。
 * 字幕の数は、そのデモの工程の数と同じにする（テストで確かめている）。
 * 画面を変えたら、ここも直す。細かい手順はよくある質問（lib/vendor/helpFaq.ts）に任せる。
 */

export type TourScene =
  | "chat-hours"
  | "chat-payment"
  | "home-actions"
  | "closed-day"
  | "store-groups"
  | "post-photo"
  | "post-period"
  | "posts-tabs"
  | "posts-repost"
  | "analytics-hero"
  | "analytics-questions"
  | "memory-learn"
  | "memory-toggle"
  | "inquiries-send";

export type TourSlide = {
  scene: TourScene;
  title: string;
  body: string;
  /** デモの工程ごとの一言。デモの下に並び、いま動いている工程が強調される */
  captions: readonly string[];
};

export type TourFeature = {
  /** 「見た」の記録に使う名前。DB の vendor_tour_seen.tour_key（英小文字・数字・ハイフン）。変えると、もう一度自動で出る */
  key: string;
  /** 機能の名前。複数の機能がある画面で、スライドの上に出す */
  name: string;
  slides: readonly TourSlide[];
};

export type VendorTourPage = {
  /** この画面（末尾の / は無視する） */
  path: string;
  /** 「?」ボタンの読み上げ用。例: 「近況を出す」の説明を見る */
  screenName: string;
  features: readonly TourFeature[];
};

export const VENDOR_TOUR_PAGES: readonly VendorTourPage[] = [
  {
    path: "/my-shop",
    screenName: "出店者トップ",
    features: [
      {
        key: "home-chat",
        name: "にちよさんへの相談",
        slides: [
          {
            scene: "chat-hours",
            title: "言葉にするだけで、お店の情報が直せます",
            body: "営業時間・支払い方法・雨の日・SNS・今週の商品は、話しかければ変更案が出ます。保存するまでは変わりません。",
            captions: ["にちよさんに話しかける", "言葉にして送る", "変更案が出る", "確かめて、保存で反映"],
          },
        ],
      },
      {
        key: "home-actions",
        name: "よく使う2つ",
        slides: [
          {
            scene: "home-actions",
            title: "いちばん使うのは、この2つ",
            body: "写真や商品、出店日のように会話で直せないものは、「店舗情報を更新」から変えます。",
            captions: ["ホームの2つのボタン", "近況を出す：今日のおすすめを伝える", "店舗情報を更新：写真・商品・出店日を直す"],
          },
        ],
      },
      {
        key: "home-calendar",
        name: "お休みカレンダー",
        slides: [
          {
            scene: "closed-day",
            title: "お休みする日曜日は、押すだけで登録",
            body: "登録しておくと、お客さんの画面に「お休み」と出て、無駄足を防げます。",
            captions: ["お休みする日曜日を選ぶ", "押すと「お休み」になる", "お客さんにも伝わる"],
          },
        ],
      },
    ],
  },
  {
    path: "/vendor/store",
    screenName: "店舗情報を更新",
    features: [
      {
        key: "store",
        name: "店舗情報",
        slides: [
          {
            scene: "store-groups",
            title: "直したい所を押して、入力して保存",
            body: "項目は4つのまとまりに分かれています。写真・主な商品・出店日はここから直します。",
            captions: ["4つのまとまり", "直したい所を押す", "入力して保存"],
          },
          {
            scene: "chat-payment",
            title: "支払い方法や営業時間は、話しかけても直せます",
            body: "出店者トップでにちよさんに伝えると、変更案が出ます。確かめて保存すると反映されます。",
            captions: ["にちよさんに話しかける", "言葉にして送る", "変更案が出る", "確かめて、保存で反映"],
          },
        ],
      },
    ],
  },
  {
    path: "/vendor/post/new",
    screenName: "近況を出す",
    features: [
      {
        key: "post-new",
        name: "近況を出す",
        slides: [
          {
            scene: "post-photo",
            title: "写真を1枚。ひとことは無くてもOK",
            body: "今日のおすすめや売り切れを、近況とマップのお店に出せます。写真は必須です。",
            captions: ["写真を撮るか選ぶ", "写真が入る", "ひとこと（なくてもOK）", "「出す」で公開"],
          },
          {
            scene: "post-period",
            title: "出しておく期間を選べます",
            body: "「日曜まで」「1時間だけ」「時間を決める」から選びます。過ぎたら自動で見えなくなります。",
            captions: ["期間を選ぶ", "「1時間だけ」にすると", "時間が来たら自動で消える"],
          },
        ],
      },
    ],
  },
  {
    path: "/vendor/posts",
    screenName: "投稿履歴",
    features: [
      {
        key: "posts",
        name: "投稿履歴",
        slides: [
          {
            scene: "posts-tabs",
            title: "これまでの近況を、絞り込んで見返せます",
            body: "「すべて」「公開中」「期限切れ」から選べます。",
            captions: ["すべての投稿", "「期限切れ」を押す", "期限切れだけが並ぶ"],
          },
          {
            scene: "posts-repost",
            title: "前の投稿を、もう一度出せます",
            body: "そのまま、または写真とひとことを直して出し直せます。",
            captions: ["期限切れの投稿", "「出し直す」を押す", "公開中でもう一度出る"],
          },
        ],
      },
    ],
  },
  {
    path: "/vendor/analytics",
    screenName: "お店の分析",
    features: [
      {
        key: "analytics",
        name: "お店の分析",
        slides: [
          {
            scene: "analytics-hero",
            title: "この1週間のお店の反応が、一番上に",
            body: "お店が見られた回数、にちよさんのおすすめ、もらったハートが並びます。数字は記録があるぶんだけ出ます。",
            captions: ["見られた回数", "先週との違い", "おすすめ・ハート"],
          },
          {
            scene: "analytics-questions",
            title: "お客さんが気になっていることも分かります",
            body: "聞かれたことと探されているものは、次に何を出すかの参考になります。",
            captions: ["お客さんの質問が並ぶ", "多い順に分かる", "探されているものも分かる"],
          },
        ],
      },
    ],
  },
  {
    path: "/vendor/ai-knowledge",
    screenName: "にちよさんの覚えごと",
    features: [
      {
        key: "ai-knowledge",
        name: "にちよさんの覚えごと",
        slides: [
          {
            scene: "memory-learn",
            title: "話したことを、にちよさんが覚えます",
            body: "混む時間やおすすめの食べ方など、お客さんに聞かれたときの案内に使います。",
            captions: ["伝えたいことを話す", "「覚えてや」と答える", "覚えごとに入る"],
          },
          {
            scene: "memory-toggle",
            title: "使い道を決める・忘れさせる",
            body: "お客さんへの案内に使うか、自分の相談だけに使うかを、1つずつ選べます。",
            captions: ["使い道は2つ", "オフにすると案内に使わない", "忘れさせることもできる"],
          },
        ],
      },
    ],
  },
  {
    path: "/vendor/inquiries",
    screenName: "運営・市役所との連絡",
    features: [
      {
        key: "inquiries",
        name: "運営・市役所との連絡",
        slides: [
          {
            scene: "inquiries-send",
            title: "質問・報告・相談を、ここから送れます",
            body: "出店場所や出店料のことは、ここから聞いてください。お知らせもここで見られます。",
            captions: ["種類を選ぶ", "内容を書く", "送る", "返事がここに届く"],
          },
        ],
      },
    ],
  },
  {
    path: "/my-shop/schedule",
    screenName: "出店予定の管理",
    features: [
      {
        key: "schedule",
        name: "出店予定の管理",
        slides: [
          {
            scene: "closed-day",
            title: "お休みする日曜日を登録",
            body: "登録しておくと、お客さんに正しく伝わります。",
            captions: ["お休みする日曜日を選ぶ", "押すと「お休み」になる", "お客さんにも伝わる"],
          },
        ],
      },
    ],
  },
];

function normalizePath(path: string): string {
  return path.trim().replace(/\/+$/, "") || "/";
}

/** いま開いている画面の説明。説明のない画面は null */
export function findVendorTourPage(pathname: string | null | undefined): VendorTourPage | null {
  if (!pathname) return null;
  const path = normalizePath(pathname);
  return VENDOR_TOUR_PAGES.find((page) => page.path === path) ?? null;
}

/** 機能の key から、その機能を返す。知らない key は null */
export function findVendorTourFeature(key: string): TourFeature | null {
  for (const page of VENDOR_TOUR_PAGES) {
    const feature = page.features.find((item) => item.key === key);
    if (feature) return feature;
  }
  return null;
}

/** 記録してよい tour_key か（API の入口で使う。知らない名前は DB に入れない） */
export function isVendorTourKey(key: unknown): key is string {
  return typeof key === "string" && findVendorTourFeature(key) !== null;
}
