// スプレッドシートの見た目（どのタブの、どの場所の、何の文言か）を key から決める（docs/SITE_COPY.md）。
// シートの「場所」「項目」列は、文言を直す人が「これはどこの文言か」を知るためのもの。取り込みでは読まない。

/** 文言を載せるタブ。texts.json の並び（faq → about → mapIntro → landing）に合わせている */
export const TEXT_TABS = [
  { name: "FAQページ", prefix: "faq." },
  { name: "LP", prefix: "about." },
  { name: "マップ案内", prefix: "mapIntro." },
  { name: "トップページ", prefix: "landing." },
];

/** LP（app/about）のスライド。並びは表示順 */
const ABOUT_SLIDES = [
  ["intro", "はじめに"],
  ["painPoints", "悩み"],
  ["concept", "コンセプト"],
  ["map", "マップ"],
  ["search", "さがす"],
  ["consult", "AIに相談"],
  ["story", "近況"],
  ["calendar", "カレンダー"],
  ["facilities", "おでかけサポート"],
  ["achievements", "実績"],
  ["supporters", "ご支援"],
  ["team", "チーム"],
  ["opensource", "オープンソース"],
  ["roadmap", "これから"],
  ["version", "バージョン"],
  ["cta", "締め"],
];

const SLIDE_PARTS = { title: "見出し", description: "説明", action: "ボタン" };
const ACHIEVEMENT_PARTS = { label: "上の小さな字", value: "大きな字", sub: "下の小さな字" };
const CONSULT_PARTS = { name: "名前", role: "役割", desc: "説明" };

const MAP_INTRO_SECTIONS = {
  welcome: "冒頭",
  map: "01 地図",
  search: "02 ジャンル",
  consult: "03 相談",
  odekake: "04 おでかけ",
  end: "最後",
};

const MAP_INTRO_FIXED = {
  badge: ["冒頭", "いちばん上の小さな札"],
  title: ["冒頭", "大見出し"],
  lead: ["冒頭", "大見出しの下の紹介文（**で囲むと太字）"],
  railHint: ["全体", "にちよさんを押しただけのときの一言"],
  endTitle: ["最後", "案内の最後の見出し"],
  aboutLink: ["最後", "LP へのリンクの文字"],
  close: ["最後", "下の緑のボタン"],
};

const CONSULT_DEMO_FIXED = {
  greeting: "にちよさんの最初の一言",
  prompt: "その下の小さな字",
  note: "いちばん下の注意書き",
};

/** トップページ（app/(public)/page.tsx と _landing/）。key（landing. の後ろ）→ [場所, 項目]。並びはページの上から */
const LANDING = {
  "meta.title": ["ページ全体", "ブラウザのタブ名・検索結果の題名"],
  "meta.description": ["ページ全体", "検索結果・SNS共有の説明文の後半（前半はマップ案内の紹介文。ページ上には出ない）"],
  "meta.ogImageAlt": ["ページ全体", "SNS共有の画像の説明（読み上げ用）"],
  "hero.kicker": ["最初の画面", "見出しの上の小さな字"],
  "hero.title1": ["最初の画面", "大見出しの1行目"],
  "hero.title2": ["最初の画面", "大見出しの2行目"],
  "hero.photoAlt": ["最初の画面", "背景の写真の説明（読み上げ用）"],
  "hero.calendarLink": ["最初の画面", "日めくりカレンダーのリンクの説明（読み上げ用）"],
  "hero.mapButton": ["最初の画面", "大きな緑のボタン"],
  "hero.searchLabel": ["最初の画面", "検索欄の名前（読み上げ用）"],
  "hero.searchPlaceholder": ["最初の画面", "検索欄に薄く出る例（スマホ）"],
  "hero.searchButton": ["最初の画面", "検索のボタン"],
  "pc.brand1": ["最初の画面（パソコン）", "ロゴの横の小さな字の1行目"],
  "pc.brand2": ["最初の画面（パソコン）", "ロゴの横の小さな字の2行目"],
  "pc.navLabel": ["最初の画面（パソコン）", "右上の案内リンクのまとまりの名前（読み上げ用）"],
  "pc.nav.calendar": ["最初の画面（パソコン）", "右上の案内リンク1"],
  "pc.nav.outing": ["最初の画面（パソコン）", "右上の案内リンク2（おでかけサポートを出すときだけ）"],
  "pc.nav.about": ["最初の画面（パソコン）", "右上の案内リンク3"],
  "pc.lead1": ["最初の画面（パソコン）", "大見出しの下の文の1行目"],
  "pc.lead2": ["最初の画面（パソコン）", "大見出しの下の文の2行目"],
  "pc.searchPlaceholder": ["最初の画面（パソコン）", "検索欄に薄く出る例"],
  "fab.label": ["右下の丸いボタン", "ボタンの下の字"],
  "fab.aria": ["右下の丸いボタン", "ボタンの説明（読み上げ用）"],
  "genres.title": ["ジャンル", "見出し"],
  "howTo.title": ["使い方", "見出し"],
  "howTo.1.title": ["使い方 01", "見出し"],
  "howTo.1.aria": ["使い方 01", "動く画面の説明（読み上げ用）"],
  "howTo.map.query": ["使い方 01", "見本：検索欄に打ち込まれる語"],
  "howTo.map.shopName": ["使い方 01", "見本：下に出るお店の名前"],
  "howTo.map.shopSub": ["使い方 01", "見本：お店の名前の下の小さな字"],
  "howTo.2.title": ["使い方 02", "見出し"],
  "howTo.2.aria": ["使い方 02", "動く画面の説明（読み上げ用）"],
  "howTo.banner.shopName": ["使い方 02", "見本：お店の名前"],
  "howTo.banner.tagline": ["使い方 02", "見本：お店の名前の下の小さな字"],
  "howTo.banner.product1": ["使い方 02", "見本：商品1（250円）"],
  "howTo.banner.product2": ["使い方 02", "見本：商品2（900円）"],
  "howTo.3.title": ["使い方 03", "見出し"],
  "howTo.3.aria": ["使い方 03", "動く画面の説明（読み上げ用）"],
  "howTo.consult.greeting": ["使い方 03", "見本：にちよさんの最初の一言"],
  "howTo.consult.prompt": ["使い方 03", "見本：その下の小さな字"],
  "howTo.consult.question": ["使い方 03", "見本：押される質問"],
  "howTo.consult.other1": ["使い方 03", "見本：ほかの質問1"],
  "howTo.consult.other2": ["使い方 03", "見本：ほかの質問2"],
  "howTo.consult.answer": ["使い方 03", "見本：にちよさんの答え"],
  "howTo.consult.shop1.name": ["使い方 03", "見本：おすすめのお店1の名前"],
  "howTo.consult.shop1.item": ["使い方 03", "見本：おすすめのお店1の品物"],
  "howTo.consult.shop2.name": ["使い方 03", "見本：おすすめのお店2の名前"],
  "howTo.consult.shop2.item": ["使い方 03", "見本：おすすめのお店2の品物"],
  "howTo.consult.placeholder": ["使い方 03", "見本：下の入力欄に薄く出る例"],
  "info.title": ["開催のご案内", "見出し"],
  "info.upcoming": ["開催のご案内", "日曜の並びの見出し"],
  "info.calendarLink": ["開催のご案内", "開催カレンダーへのリンク"],
  "info.when.label": ["開催のご案内", "看板1の小さな字"],
  "info.when.detail": ["開催のご案内", "看板1の大きな字"],
  "info.where.label": ["開催のご案内", "看板2の小さな字"],
  "info.where.detail": ["開催のご案内", "看板2の大きな字"],
  "highlights.title": ["日曜市のいいところ", "見出し"],
  "highlights.history.title": ["日曜市のいいところ", "写真1の上の手書きの一言"],
  "highlights.history.photoAlt": ["日曜市のいいところ", "写真1の説明（読み上げ用）"],
  "highlights.people.title": ["日曜市のいいところ", "写真2の上の手書きの一言"],
  "highlights.people.photoAlt": ["日曜市のいいところ", "写真2の説明（読み上げ用）"],
  "highlights.walk.title": ["日曜市のいいところ", "写真3の上の手書きの一言"],
  "highlights.walk.photoAlt": ["日曜市のいいところ", "写真3の説明（読み上げ用）"],
  "highlights.shopPhotos": ["日曜市のいいところ", "お店の写真の帯の名前（読み上げ用）"],
  "about.title1": ["nicchyo について", "見出しの1行目"],
  "about.title2": ["nicchyo について", "見出しの2行目"],
  "about.photoAlt": ["nicchyo について", "写真の説明（読み上げ用）"],
  "about.body": ["nicchyo について", "説明"],
  "about.awardName": ["nicchyo について", "受賞：賞の名前（小さな字）"],
  "about.awardTitle": ["nicchyo について", "受賞：受けた賞（大きな字）"],
  "about.message1": ["nicchyo について", "開発チームのひとことの1行目"],
  "about.message2": ["nicchyo について", "開発チームのひとことの2行目"],
  "about.signature": ["nicchyo について", "ひとことの署名"],
  "about.activitiesLink": ["nicchyo について", "活動記録へのボタン"],
};

/**
 * key から、シート上の置き場所を決める。知らない key は「その他」に入れる（取り込みは key だけで動くので止まらない）。
 * @returns {{ tab: string, place: string, item: string }}
 */
export function describeKey(key) {
  const tab = TEXT_TABS.find((t) => key.startsWith(t.prefix))?.name ?? TEXT_TABS[0].name;
  const parts = key.split(".");
  const fallback = { tab, place: "その他", item: key };

  if (parts[0] === "faq") {
    if (key === "faq.title") return { tab, place: "ページ全体", item: "見出し・ブラウザのタブ名" };
    if (key === "faq.description") return { tab, place: "ページ全体", item: "検索結果・SNS共有の説明文（ページ上には出ない）" };
    return fallback;
  }

  if (parts[0] === "about") {
    if (key === "about.meta.title") return { tab, place: "ページ全体", item: "ブラウザのタブ名" };
    if (key === "about.meta.description") return { tab, place: "ページ全体", item: "検索結果・SNS共有の説明文（ページ上には出ない）" };
    if (key === "about.nav.next") return { tab, place: "下のボタン", item: "最後以外のスライド" };
    if (key === "about.nav.done") return { tab, place: "下のボタン", item: "最後のスライド" };

    const slideAt = ABOUT_SLIDES.findIndex(([id]) => id === parts[1]);
    if (slideAt < 0) return fallback;
    const place = `${slideAt + 1}枚目 ${ABOUT_SLIDES[slideAt][1]}`;
    const rest = parts.slice(2);

    if (rest.length === 1 && SLIDE_PARTS[rest[0]]) return { tab, place, item: SLIDE_PARTS[rest[0]] };
    if (rest.length === 1 && /^\d+$/.test(rest[0])) return { tab, place, item: `項目${rest[0]}` };
    if (parts[1] === "consult" && rest.length === 2 && CONSULT_PARTS[rest[1]]) {
      return { tab, place, item: `項目${rest[0]}の${CONSULT_PARTS[rest[1]]}` };
    }
    if (parts[1] === "achievements" && rest.length === 2 && ACHIEVEMENT_PARTS[rest[1]]) {
      const note = key === "about.achievements.3.value" ? "（訪問者数が取れないときだけ出る）" : "";
      return { tab, place, item: `項目${rest[0]}の${ACHIEVEMENT_PARTS[rest[1]]}${note}` };
    }
    return { tab, place, item: key };
  }

  if (parts[0] === "mapIntro") {
    if (parts.length === 2 && MAP_INTRO_FIXED[parts[1]]) {
      const [place, item] = MAP_INTRO_FIXED[parts[1]];
      return { tab, place, item };
    }
    if (parts.length === 3 && MAP_INTRO_SECTIONS[parts[1]]) {
      const place = MAP_INTRO_SECTIONS[parts[1]];
      if (parts[2] === "label") return { tab, place, item: "節の名前（下の点の読み上げにも使う）" };
      if (parts[2] === "comment") return { tab, place, item: "にちよさんの吹き出し" };
    }
    if (parts[1] === "consultDemo") {
      const place = "相談デモ";
      if (parts.length === 3 && CONSULT_DEMO_FIXED[parts[2]]) return { tab, place, item: CONSULT_DEMO_FIXED[parts[2]] };
      if (parts.length === 4 && parts[3] === "q") return { tab, place, item: `見本${parts[2]}の質問` };
      if (parts.length === 4 && parts[3] === "a") return { tab, place, item: `見本${parts[2]}の答え` };
    }
  }

  if (parts[0] === "landing") {
    const found = LANDING[parts.slice(1).join(".")];
    if (found) return { tab, place: found[0], item: found[1] };
  }
  return fallback;
}
