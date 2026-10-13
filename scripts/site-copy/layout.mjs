// スプレッドシートの見た目（どのタブの、どの場所の、何の文言か）を key から決める（docs/SITE_COPY.md）。
// シートの「場所」「項目」列は、文言を直す人が「これはどこの文言か」を知るためのもの。取り込みでは読まない。

/** 文言を載せるタブ。texts.json の並び（faq → about → mapIntro）に合わせている */
export const TEXT_TABS = [
  { name: "FAQページ", prefix: "faq." },
  { name: "LP", prefix: "about." },
  { name: "マップ案内", prefix: "mapIntro." },
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
  return fallback;
}
