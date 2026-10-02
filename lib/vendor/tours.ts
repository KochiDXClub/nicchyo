/**
 * 出店者の画面ごとの説明パネル（右上の「?」から何度でも見られる。初めて開いた画面では自動で出る）。
 *
 * 画面を足したり、使い方が変わったら、ここを直す。よくある質問（lib/vendor/helpFaq.ts）と違い、
 * 「いま開いている画面は何をする所か」を2〜3枚で見せるだけにする。細かい手順は質問に任せる。
 * 絵は components/vendor/tour/TourIllustration.tsx の scene から選ぶ（画面の写真は使わない。画面が変わると古くなるため）。
 */

export type TourScene = "chat" | "form" | "camera" | "calendar" | "chart" | "mail" | "memory" | "history";

export type TourSlide = {
  scene: TourScene;
  title: string;
  body: string;
};

export type VendorTour = {
  /** 「見た」の記録に使う名前。DB の vendor_tour_seen.tour_key。変えると、もう一度自動で出る */
  key: string;
  /** この画面（末尾の / は無視する） */
  path: string;
  /** 「?」ボタンの読み上げ用。例: 「近況を出す」の説明を見る */
  screenName: string;
  slides: readonly TourSlide[];
};

export const VENDOR_TOURS: readonly VendorTour[] = [
  {
    key: "home",
    path: "/my-shop",
    screenName: "出店者トップ",
    slides: [
      {
        scene: "chat",
        title: "困ったら、にちよさんに話しかけてや",
        body: "使い方の質問も、「営業時間を変えたい」のようなお願いも、ここで言葉にするだけ。",
      },
      {
        scene: "form",
        title: "変える前に、かならず確かめます",
        body: "にちよさんが出した案を、あなたが直して「保存」するまで、お店の情報は変わりません。",
      },
      {
        scene: "camera",
        title: "写真や商品は、画面から",
        body: "お店の写真・主な商品と価格・出店日は、「店舗情報を更新」から変えてください。",
      },
    ],
  },
  {
    key: "store",
    path: "/vendor/store",
    screenName: "店舗情報を更新",
    slides: [
      {
        scene: "form",
        title: "直したい項目を押して入力",
        body: "お店の顔・品ぞろえ・出店のこと・つながり・こだわり、の順に並んでいます。",
      },
      {
        scene: "chat",
        title: "営業時間や支払い方法は、話しかけても直せます",
        body: "出店者トップで、にちよさんに伝えると変更案が出ます。",
      },
    ],
  },
  {
    key: "post-new",
    path: "/vendor/post/new",
    screenName: "近況を出す",
    slides: [
      {
        scene: "camera",
        title: "写真を1枚、撮るか選ぶだけ",
        body: "ひとことは無くても出せます。今日のおすすめや売り切れを、マップのお店にも出せます。",
      },
      {
        scene: "calendar",
        title: "出しておく期間を選べます",
        body: "「日曜まで」「1時間だけ」「時間を決める」から選び、過ぎたら自動で見えなくなります。",
      },
    ],
  },
  {
    key: "posts",
    path: "/vendor/posts",
    screenName: "投稿履歴",
    slides: [
      {
        scene: "history",
        title: "これまでの近況を見返せます",
        body: "いま見えているものと、期間が過ぎたものに分かれています。",
      },
      {
        scene: "camera",
        title: "前の投稿を、もう一度出せます",
        body: "そのまま、または写真とひとことを直して出し直せます。",
      },
    ],
  },
  {
    key: "analytics",
    path: "/vendor/analytics",
    screenName: "お店の分析",
    slides: [
      {
        scene: "chart",
        title: "この1週間のお店の反応",
        body: "お店が見られた回数、にちよさんのおすすめ、もらったハートが一番上に出ます。",
      },
      {
        scene: "chat",
        title: "お客さんが聞いたことも分かります",
        body: "いつ・どこから見られたか、探されているものは、近況や商品を考える参考に。",
      },
    ],
  },
  {
    key: "ai-knowledge",
    path: "/vendor/ai-knowledge",
    screenName: "にちよさんの覚えごと",
    slides: [
      {
        scene: "memory",
        title: "にちよさんが覚えたお店のこと",
        body: "混む時間やおすすめの食べ方など、お客さんに聞かれたときの案内に使います。",
      },
      {
        scene: "form",
        title: "直す・忘れさせる・使い道を選ぶ",
        body: "お客さんへの案内に使うか、自分の相談だけに使うかを、1つずつ決められます。",
      },
    ],
  },
  {
    key: "inquiries",
    path: "/vendor/inquiries",
    screenName: "運営・市役所との連絡",
    slides: [
      {
        scene: "mail",
        title: "お知らせを見る・運営に送る",
        body: "質問・報告・相談を送れます。出店場所や出店料のことは、ここから聞いてください。",
      },
    ],
  },
  {
    key: "schedule",
    path: "/my-shop/schedule",
    screenName: "出店予定の管理",
    slides: [
      {
        scene: "calendar",
        title: "お休みする日曜日を登録",
        body: "登録しておくと、お客さんに正しく伝わります。",
      },
    ],
  },
];

function normalizePath(path: string): string {
  return path.trim().replace(/\/+$/, "") || "/";
}

/** いま開いている画面の説明。説明のない画面は null */
export function findVendorTour(pathname: string | null | undefined): VendorTour | null {
  if (!pathname) return null;
  const path = normalizePath(pathname);
  return VENDOR_TOURS.find((tour) => tour.path === path) ?? null;
}

/** 記録してよい tour_key か（API の入口で使う。知らない名前は DB に入れない） */
export function isVendorTourKey(key: unknown): key is string {
  return typeof key === "string" && VENDOR_TOURS.some((tour) => tour.key === key);
}
