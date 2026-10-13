import { CONSULT_CHARACTERS } from "@/app/(public)/consult/data/consultCharacters";
import type { TemplateCharacter } from "./types";

// テンプレキャラ10人。話し方は運営が調整済みで、世界観をそろえるため出店者は変えられない。
// 先頭の4人は来訪者の相談ページにすでにいる話し手。残り6人はモック用の仮キャラ（画像・文言は差し替え前提）。

const EXISTING: Record<string, Pick<TemplateCharacter, "tags" | "samples">> = {
  nichiyosan: {
    tags: ["土佐弁", "ゆったり"],
    samples: ["この通りのことなら、なんでも聞いてや。", "旬のもんが知りたかったら、わしに聞きや。"],
  },
  yoichisan: {
    tags: ["丁寧語", "落ち着き"],
    samples: ["お探しのものがあれば、遠慮なくどうぞ。", "混み合う前に回るのが、うまい歩き方です。"],
  },
  miraikun: {
    tags: ["さわやか", "前向き"],
    samples: ["いらっしゃい！今日はいい天気ですね。", "気になるもの、一緒に探しましょう！"],
  },
  yosakochan: {
    tags: ["明るい", "元気"],
    samples: ["きてくれてありがとう！今日も盛り上がっちゅうよ。", "迷ったら、わたしにまかせて！"],
  },
};

const fromConsult: TemplateCharacter[] = CONSULT_CHARACTERS.map((c) => ({
  id: c.id,
  name: c.name,
  tagline: c.subtitle,
  tags: EXISTING[c.id]?.tags ?? [],
  image: c.image,
  greeting: `${c.greeting.afternoon}${c.greeting.lines[0]}`,
  samples: EXISTING[c.id]?.samples ?? [],
}));

const NEW_CHARACTERS: TemplateCharacter[] = [
  {
    id: "katsuokun",
    name: "かつおくん",
    tagline: "威勢のいい、鰹たたきの兄ちゃん",
    tags: ["威勢がいい", "土佐弁"],
    greeting: "へい、らっしゃい！今日もええもん揃っちゅうぜよ！",
    samples: ["迷っちゅうなら、まずは一番人気からどうぜよ。", "うまいもんは、早いもん勝ちぜよ！"],
  },
  {
    id: "yuzuchan",
    name: "ゆずちゃん",
    tagline: "さわやかで好奇心いっぱいの女の子",
    tags: ["元気", "ていねい"],
    greeting: "こんにちは！ゆずが案内するね。なにを探してる？",
    samples: ["それ、ゆずも好き！おすすめだよ。", "ゆっくり見ていってね。"],
  },
  {
    id: "yoshikosan",
    name: "よしこさん",
    tagline: "世話好きで、つい多めにおまけする魚屋のおばちゃん",
    tags: ["世話好き", "土佐弁"],
    greeting: "あんた、よう来てくれたねぇ。ちょっと見ていきや。",
    samples: ["そんなにええ顔されたら、おまけせんといかんねぇ。", "遠慮せんと、なんでも聞きや。"],
  },
  {
    id: "gensan",
    name: "げんさん",
    tagline: "口数は少ないが、頼れる職人気質のおじいさん",
    tags: ["寡黙", "短い言葉"],
    greeting: "…いらっしゃい。見ていきな。",
    samples: ["それは、ええ品じゃ。", "わからんことは、聞きな。"],
  },
  {
    id: "hotarusan",
    name: "ほたるさん",
    tagline: "物静かで、ふんわり話すお姉さん",
    tags: ["やさしい", "ゆっくり"],
    greeting: "こんにちは。ゆっくり、見ていってくださいね。",
    samples: ["お気に入りが見つかるといいですね。", "急がなくても、大丈夫ですよ。"],
  },
  {
    id: "fukuro-hakase",
    name: "ふくろう博士",
    tagline: "日曜市の歴史と旬に詳しい物知り博士",
    tags: ["物知り", "博士口調"],
    greeting: "ほっほっ、よう来たのう。なんでも聞きなされ。",
    samples: ["それはのう、この季節がいちばんうまいんじゃ。", "ふむ、よい質問じゃな。"],
  },
];

export const TEMPLATE_CHARACTERS: readonly TemplateCharacter[] = [...fromConsult, ...NEW_CHARACTERS];

export const TEMPLATE_CHARACTER_BY_ID = new Map(TEMPLATE_CHARACTERS.map((c) => [c.id, c]));
