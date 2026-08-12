import { AboutIconName } from "./AboutIcon";
import { currentVersion, type VersionEntry } from "./versions";

export type CharacterItem = {
  img: string;
  name: string;
  role: string;
  desc: string;
  bg: string;
};

export type AchievementItem = {
  emoji: string;
  label: string;
  value: string;
  sub: string;
  /** AboutStory 側で実データに差し替える対象を識別するキー（任意） */
  dynamicKey?: "weeklyVisitors";
};

export type PainPointItem = {
  emoji: string;
  text: string;
};

export type SlideRichContent =
  | { type: "characters"; items: CharacterItem[] }
  | { type: "achievements"; items: AchievementItem[] }
  | { type: "painPoints"; items: PainPointItem[] }
  | { type: "version"; entry: VersionEntry };

export type AboutSlide = {
  id: string;
  title: string;
  description: string;
  iconName?: AboutIconName;
  richContent?: SlideRichContent;
  action?: {
    label: string;
    href: string;
    primary?: boolean;
  };
};

export const aboutSlides: AboutSlide[] = [
  {
    id: "intro",
    title: "nicchyo",
    description: "日曜市をもっと歩きやすく、もっと知りやすくするための小さなデジタル実験です。",
  },
  {
    id: "painPoints",
    title: "こんな悩み、ありませんか？",
    description: "日曜市ってなんとなく足が向かない理由がある。",
    richContent: {
      type: "painPoints",
      items: [
        { emoji: "🗺️", text: "広くて、どこから回ればいいかわからない" },
        { emoji: "🔍", text: "何が買えるのか、事前に調べにくい" },
        { emoji: "😶", text: "知らない人に話しかけるのが苦手" },
      ],
    },
  },
  {
    id: "concept",
    title: "迷ってこそが日曜市！",
    description: "だけど、ちょっとだけデジタルの力で「歩きやすく」「探しやすく」しました。",
  },
  {
    id: "characters",
    title: "4人のキャラクターが案内",
    description: "親しみやすいAIキャラが、あなたの「困った」に寄り添います。",
    richContent: {
      type: "characters",
      items: [
        { img: "/images/obaasan_transparent.png", name: "にちよさん", role: "やさしく案内", desc: "おだやかな言葉でゆっくり教えてくれます", bg: "bg-orange-50" },
        { img: "/images/characters/ojichan.png", name: "よういちさん", role: "落ち着いて解説", desc: "歴史や豆知識もくわしく教えてくれます", bg: "bg-sky-50" },
        { img: "/images/characters/onisan.png", name: "みらいくん", role: "テキパキ提案", desc: "テンポよく効率的な回り方を教えてくれます", bg: "bg-green-50" },
        { img: "/images/characters/onesan.png", name: "よさこちゃん", role: "気軽に話しかけやすい", desc: "フレンドリーに楽しく一緒に探してくれます", bg: "bg-pink-50" },
      ],
    },
    action: {
      label: "AIキャラに相談する",
      href: "/consult",
    },
  },
  {
    id: "map",
    title: "マップ",
    description: "今どこにいるか、近くに何があるか。屋台の位置がすぐにわかります。",
    iconName: "map",
    action: {
      label: "マップを見る",
      href: "/map",
      primary: true,
    },
  },
  {
    id: "search",
    title: "さがす",
    description: "季節の野菜や、あのお店。検索機能でお目当てを見つけやすく。",
    iconName: "spark",
    action: {
      label: "お店を探す",
      href: "/search",
    },
  },
  {
    id: "consult",
    title: "相談する",
    description: "検索では拾いきれない曖昧な関心を、AIキャラとの対話を通じて整理します。",
    iconName: "chat",
    action: {
      label: "にちよさんに聞く",
      href: "/consult",
    },
  },
  {
    id: "story",
    title: "近況",
    description: "出店者が投稿する今週の写真やお知らせをチェックできます。",
    iconName: "recipe",
    action: {
      label: "近況を見る",
      href: "/story",
    },
  },
  {
    id: "calendar",
    title: "日曜市カレンダー",
    description: "開催予定や荒天中止・特別開催のお知らせもすぐに確認できます。",
    iconName: "event",
    action: {
      label: "カレンダーを見る",
      href: "/calendar",
    },
  },
  {
    id: "facilities",
    title: "おでかけサポート",
    description: "お手洗い・休けいできるベンチ・電車やバスののりばもマップから探せます。",
    iconName: "compass",
    action: {
      label: "おでかけサポートを見る",
      href: "/facilities",
    },
  },
  {
    id: "everyone",
    title: "みんなのために",
    description:
      "買い物リストやレシピ提案も。初めての方も、常連さんも、出店者さんも、それぞれの楽しみ方をサポート。",
    iconName: "route",
  },
  {
    id: "achievements",
    title: "高知のまちと育てています",
    description: "地域とともに、少しずつ積み上げてきた実績です。",
    richContent: {
      type: "achievements",
      items: [
        { emoji: "🏆", label: "こうちNPOアワード2025", value: "ワカモノ未来賞", sub: "受賞" },
        { emoji: "🤝", label: "高知市商業振興課", value: "公式連携", sub: "実施中" },
        { emoji: "👥", label: "今週の訪問者", value: "集計中", sub: "が利用", dynamicKey: "weeklyVisitors" },
      ],
    },
    action: {
      label: "活動の記録を見る",
      href: "/activities",
    },
  },
  {
    id: "team",
    title: "チームと活動",
    description:
      "高知高専の学生と顧問の先生によるプロジェクト。現地での聞き取りを大切にしています。",
    iconName: "discover",
  },
  {
    id: "roadmap",
    title: "これからのnicchyo",
    description: "完成形を固定せず、運用と改善を繰り返しながら育てていきます。",
    richContent: {
      type: "painPoints",
      items: [
        { emoji: "🗺️", text: "1年目：デジタルマップの本格運用と検証" },
        { emoji: "📈", text: "2〜3年目：利用データをもとに定着・高度化" },
        { emoji: "🌱", text: "将来：得られた知見を他の地域マーケットへ" },
      ],
    },
  },
  {
    id: "version",
    title: `nicchyo ${currentVersion.version}`,
    description: currentVersion.title,
    richContent: {
      type: "version",
      entry: currentVersion,
    },
    action: {
      label: "過去のバージョンを見る",
      href: "/about/versions",
    },
  },
  {
    id: "cta",
    title: "さあ、日曜市へ",
    description: "デジタル片手に、新しい発見を探しに行きませんか？",
    action: {
      label: "マップを見る",
      href: "/map",
      primary: true,
    },
  },
];
