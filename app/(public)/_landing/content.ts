/**
 * トップページ（/）の文言と素材。
 *
 * 日曜市の数字（毎週日曜・約1.3km・およそ300の店）は、マップの案内（mapIntro.lead）と
 * 同じ文言をシートから読む（docs/SITE_COPY.md）。ここに数字を書き足して二重にしない。
 * ここにある文言は、まだシートに載っていないもの。
 */

export type LandingFeature = {
  id: "map" | "consult" | "search";
  /** カードの上に出す小さな札 */
  label: string;
  title: string;
  body: string;
  href: string;
  cta: string;
};

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "map",
    label: "マップ",
    title: "日曜市の店を、地図で見て歩く",
    body: "写真つきの地図で、気になる店をひらいて中をのぞけます。現在地も出るので、歩きながら使えます。",
    href: "/map",
    cta: "マップをひらく",
  },
  {
    id: "consult",
    label: "相談",
    title: "わからんことは、にちよさんに",
    body: "おすすめの食べ歩きや、はじめての回り方。日曜市のことなら、土佐ことばで答えてくれます。",
    href: "/consult",
    cta: "相談してみる",
  },
  {
    id: "search",
    label: "さがす",
    title: "品物やジャンルで、しぼりこむ",
    body: "野菜、刃物、植木、食べ歩き。見たい店だけを一覧にして、地図で場所を確かめられます。",
    href: "/search",
    cta: "お店をさがす",
  },
];

/** 「日曜市ってどんなところ？」に並べる事実。長さと店の数は見出しの mapIntro.lead が持つので、ここには書かない */
export const MARKET_FACTS: { term: string; detail: string }[] = [
  {
    term: "いつ",
    // 休市日は高知市の案内による（1月1・2日と、よさこい祭りの8月10〜12日に日曜が重なる日は休み）
    detail: "毎週日曜（1月1・2日と8月10〜12日に重なる日曜はお休み）。早朝から夕方まで、品ぞろえが多いのは午前中",
  },
  { term: "どこ", detail: "高知城のふもとから、追手筋（高知市）の東の端まで" },
  { term: "歴史", detail: "江戸時代から300年以上続く、高知の暮らしの市" },
  { term: "品もの", detail: "朝どれの野菜や果物、田舎寿司や芋天、刃物、植木、骨董まで" },
];
