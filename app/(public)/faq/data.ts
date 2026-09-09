import { Map, ShoppingBag, User, HelpCircle } from "lucide-react";

export type FaqCategory = "general" | "map" | "list" | "account";

export interface FaqItem {
  id: string;
  category: FaqCategory;
  q: string;
  a: string;
}

export const FAQ_CATEGORIES = [
  { id: "all", label: "すべて", icon: null },
  { id: "map", label: "マップ・店舗", icon: Map },
  { id: "list", label: "お買い物リスト", icon: ShoppingBag },
  { id: "account", label: "アカウント", icon: User },
  { id: "general", label: "その他", icon: HelpCircle },
] as const;

export const FAQ_DATA: FaqItem[] = [
  // Map & Shops
  {
    id: "map-free",
    category: "map",
    q: "マップは無料で使えますか？",
    a: "はい、すべての機能を無料でご利用いただけます。日曜市をより楽しんでいただくためのツールですので、安心してお使いください。",
  },
  {
    id: "map-location",
    category: "map",
    q: "位置情報は必ずオンにしないといけませんか？",
    a: "必須ではありませんが、オンにするとマップ上に現在地が表示されるので、迷わずに歩けて便利です。位置情報は地図の表示ではご自身の端末内だけで使います。AIに相談されたときは当サービスのサーバーへ送られますが、緯度・経度が外部へ渡ることはありません。詳しくはプライバシーポリシーをご覧ください。",
  },
  {
    id: "shop-search",
    category: "map",
    q: "特定のお店を探すことはできますか？",
    a: "はい、マップ画面の検索バーから店名や商品名で検索できます。「トマト」や「刃物」などのキーワードでも探せますよ。",
  },

  // Shopping List (Bag)
  {
    id: "list-save",
    category: "list",
    q: "作ったお買い物リストは保存されますか？",
    a: "はい、お使いのスマートフォンのブラウザに自動的に保存されます。次回開いたときもそのまま残っていますのでご安心ください。",
  },
  {
    id: "list-share",
    category: "list",
    q: "家族とリストを共有できますか？",
    a: "申し訳ありません。現在は共有機能はなく、それぞれの端末でリストを管理する形になっています。スクリーンショットなどを送って活用してみてくださいね。",
  },
  {
    id: "list-offline",
    category: "list",
    q: "電波が悪い場所でもリストは見られますか？",
    a: "はい、一度読み込んだリストは端末に保存されているため、電波が入りにくい場所でも確認やチェックが可能です。",
  },

  // Account
  {
    id: "account-transfer",
    category: "account",
    q: "機種変更をした場合、データは引き継げますか？",
    a: "会員登録（アカウント作成）をしていない場合、データはブラウザに残るため引き継げません。大切なデータがある場合は、設定メニューからアカウント登録をおすすめします。",
  },
  {
    id: "account-privacy",
    category: "account",
    q: "個人情報は安全ですか？",
    a: "はい。アカウント登録時に必要な情報は最小限にしており、お客様のプライバシーを第一に考えて厳重に管理しています。",
  },

  // General
  {
    id: "general-sunday",
    category: "general",
    q: "日曜市は何時から何時までやっていますか？",
    a: "基本的には早朝から夕方まで開催されていますが、お店によって異なります。午前中が品揃えも豊富で活気があるのでおすすめですよ。",
  },
  {
    id: "general-inquiry",
    category: "general",
    q: "困ったときの問い合わせ先はありますか？",
    a: "不具合やご質問がありましたら、メニュー内の「お問い合わせ」またはチャット機能からお気軽にご連絡ください。",
  },
];
