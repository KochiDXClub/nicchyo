import type { StoryItem } from "../../story/types";

/**
 * 近況のデモ（/demo/story）で流す見本の投稿。
 *
 * 出店者の投稿が始まる前に、近況がどう見えるか・店のAIキャラがどう喋るかを見せるためのもの。
 * 店・投稿・キャラはすべて架空。実在の店と取り違えないよう、店名は一般的な言葉で作り、
 * マップへのリンク（store_number）も持たせない。
 *
 * 投稿時刻は開いた時刻から逆算する（いつ開いても「今週」「先週」がそろうように）。
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const CHARACTER_IMAGE = {
  farmer: "/images/demo/story/char-farmer.svg",
  students: "/images/demo/story/char-students.svg",
  craftsman: "/images/demo/story/char-craftsman.svg",
  okami: "/images/demo/story/char-okami.svg",
} as const;

type DemoStorySeed = {
  id: string;
  /** 開いた時刻から何ミリ秒前の投稿か */
  ago: number;
  shopName: string;
  image: string;
  body: string | null;
  character?: { name: string; image: keyof typeof CHARACTER_IMAGE; line: string };
  hearts: number;
};

const SEEDS: DemoStorySeed[] = [
  {
    id: "demo-1",
    ago: 40 * 60_000,
    shopName: "山のめぐみ農園",
    image: "/images/shops/ninjin.webp",
    body: "今朝ほった人参です。葉っぱも付けています。1袋200円。",
    character: {
      name: "農園のげんじい",
      image: "farmer",
      line: "葉っぱはかき揚げにしてみいや。香りがええがよ。",
    },
    hearts: 12,
  },
  {
    id: "demo-2",
    ago: 2 * HOUR,
    shopName: "高校生ショップ ひだまり",
    image: "/images/shops/handcraft.webp",
    body: "授業で作った布小物を販売します。売上は部の活動に使います。",
    character: {
      name: "ソラとミオ",
      image: "students",
      line: "11時までに来てくれたら、名前の刺しゅうもその場でできます！",
    },
    hearts: 8,
  },
  {
    id: "demo-3",
    ago: 3 * HOUR,
    shopName: "土佐刃物 とぎや",
    image: "/images/shops/tosahamono.webp",
    body: "包丁の研ぎ直し、今日は10本まで受け付けます。",
    character: {
      name: "研ぎ師のてっちゃん",
      image: "craftsman",
      line: "切れんようになった包丁、持ってきてみいや。見ちゃるき。",
    },
    hearts: 5,
  },
  {
    id: "demo-4",
    ago: 5 * HOUR,
    shopName: "いも天 ひなた",
    image: "/images/shops/imotenn.webp",
    body: "揚げたて出てます。10時ごろは少し並びます。",
    character: {
      name: "ひなたのおかみ",
      image: "okami",
      line: "熱いき、気をつけて食べてよ。並んじゅう間に、次の揚げたてができるき。",
    },
    hearts: 21,
  },
  {
    id: "demo-5",
    ago: 26 * HOUR,
    shopName: "竹かご工房 ささ",
    image: "/images/shops/takekago.webp",
    body: "日曜市のお買い物にちょうどいい、小ぶりのかごを作りました。",
    hearts: 3,
  },
  {
    id: "demo-6",
    ago: 9 * DAY,
    shopName: "植木と花の店 みどり",
    image: "/images/shops/uekibachi.webp",
    body: "多肉植物の寄せ植え、入荷しました。",
    hearts: 4,
  },
  {
    id: "demo-7",
    ago: 10 * DAY,
    shopName: "アイスクリン まる",
    image: "/images/shops/icecream.webp",
    body: "今シーズン最後の出店です。ありがとうございました。",
    hearts: 9,
  },
  {
    id: "demo-8",
    ago: 20 * DAY,
    shopName: "器の店 つち",
    image: "/images/shops/dish.webp",
    body: "普段使いの小皿、色違いで並べています。",
    hearts: 2,
  },
];

export function buildDemoStories(now: number): {
  stories: StoryItem[];
  heartCounts: Record<string, number>;
} {
  const stories = SEEDS.map<StoryItem>((seed) => ({
    id: seed.id,
    body: seed.body,
    image_url: seed.image,
    expires_at: new Date(now + 7 * DAY).toISOString(),
    created_at: new Date(now - seed.ago).toISOString(),
    vendor: {
      id: `demo-vendor-${seed.id}`,
      shop_name: seed.shopName,
      shop_image_url: seed.character ? CHARACTER_IMAGE[seed.character.image] : null,
      store_number: null,
    },
    character: seed.character
      ? { name: seed.character.name, imageUrl: CHARACTER_IMAGE[seed.character.image], line: seed.character.line }
      : null,
  }));
  const heartCounts = Object.fromEntries(SEEDS.map((seed) => [seed.id, seed.hearts]));
  return { stories, heartCounts };
}
