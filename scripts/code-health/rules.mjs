// コード健康診断の「ものさし」。
// 数値が増えたら悪化、減ったら改善という向きで揃えてある（比率は target と比べる）。
// ルールの根拠は CLAUDE.md の Coding Conventions と docs/DESIGN_SYSTEM.md。
// ルールを足すときはここに1件足すだけでよい（集計・差分・レポートは自動で拾う）。

/** 共通基盤とみなす場所 */
export const SHARED_ROLES = new Set(["shared-ui", "shared-logic"]);

/**
 * 機能（role）の定義。順番がレポートの凡例・色の順番になる。
 * 色はカテゴリ用のパレットを固定順で割り当てる（dataviz の既定パレット）。
 */
export const ROLES = [
  { id: "page", label: "ページ", color: "#2a78d6", darkColor: "#3987e5" },
  { id: "page-ui", label: "ページ専用UI", color: "#eb6834", darkColor: "#d95926" },
  { id: "page-logic", label: "ページ専用ロジック", color: "#1baf7a", darkColor: "#199e70" },
  { id: "api", label: "APIルート・proxy", color: "#eda100", darkColor: "#c98500" },
  { id: "shared-ui", label: "共通UI（components/）", color: "#e87ba4", darkColor: "#d55181" },
  { id: "shared-logic", label: "共通ロジック（lib/・utils/）", color: "#008300", darkColor: "#008300" },
  { id: "test", label: "テスト", color: "#4a3aa7", darkColor: "#9085e9" },
  { id: "other", label: "型・設定・生成物・データ・スクリプト", color: "#b5b3ab", darkColor: "#5c5b56" },
];

/**
 * 全体の指標。value は analyze.mjs が計算する。
 * better: "lower" | "higher"。target は「最適な状態」の目安。
 */
export const METRICS = [
  {
    id: "sharedRatio",
    label: "共通化率",
    unit: "%",
    better: "higher",
    target: 30,
    why: "アプリ本体のうち lib/・components/・utils/ にある割合。低いほど各ページが個別に同じものを作っている可能性が高い",
  },
  {
    id: "duplicationRatio",
    label: "コピペ率",
    unit: "%",
    better: "lower",
    target: 3,
    why: "8行以上そっくり同じ塊が他の場所にもある行の割合。片方だけ直して食い違う原因になる",
  },
  {
    id: "largeFiles",
    label: "巨大ファイル（600行超）",
    unit: "件",
    better: "lower",
    target: 10,
    why: "1ファイルに役割が詰め込まれていると、変更の影響範囲が読めずレビューも難しくなる",
  },
  {
    id: "sameNameComponents",
    label: "同名の部品が別ページにある",
    unit: "組",
    better: "lower",
    target: 0,
    why: "別々のページに同じ名前の部品がある = 同じものを2回作っている候補（車輪の再発明）",
  },
];

/**
 * 書き方のルール。pattern に当たった数を数える。
 * scope: 対象ファイルの条件。allow: 例外（共通基盤そのもの等）。
 * countMode: "matches"（出現数）| "files"（該当ファイル数）| "unique"（出現した文字列の種類数）
 * normalize: 種類を数えるときの正規化（省略時は前後の空白だけ落とす）
 */
export const RULES = [
  {
    id: "rawHex",
    label: "生の hex カラー（種類）",
    source: "DESIGN_SYSTEM.md §5",
    why: "色はトークンで指定する。hex が増えるほど同じ意味の色がバラバラになる",
    pattern: /(?<![\w&])#[0-9a-fA-F]{6}\b|(?<![\w&])#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g,
    scope: (f) => f.kind === "own" && /\.tsx$/.test(f.path),
    countMode: "unique",
    // #FFF と #fff は同じ色なので1種類と数える
    normalize: (m) => m.toLowerCase(),
  },
  {
    id: "neutralPalette",
    label: "slate-* / gray-* の使用",
    source: "DESIGN_SYSTEM.md §3",
    why: "文字は nicchyo-ink の不透明度、罫は line トークンで書く",
    pattern: /\b(?:slate|gray)-\d{2,3}\b/g,
    scope: (f) => f.kind === "own" && /\.tsx?$/.test(f.path),
    countMode: "matches",
  },
  {
    id: "rawRounded",
    label: "角丸の直書き（rounded-xl / 2xl / [px]）",
    source: "DESIGN_SYSTEM.md §3",
    why: "rounded-card / rounded-btn などのトークンに寄せる",
    pattern: /\brounded-(?:xl|2xl|3xl|\[\d+px\])(?![\w-])/g,
    scope: (f) => f.kind === "own" && /\.tsx$/.test(f.path),
    countMode: "matches",
  },
  {
    id: "gradients",
    label: "グラデーション（種類）",
    source: "DESIGN_SYSTEM.md §5",
    why: "面は単色で足りる。グラデーションを増やさない",
    pattern: /bg-gradient-to-[a-z]+(?:\s+(?:from|via|to)-[\w/[\]#.-]+)*|(?:linear|radial)-gradient\([^)]*\)/g,
    scope: (f) => f.kind === "own" && /\.tsx?$/.test(f.path),
    countMode: "unique",
  },
  {
    id: "adhocModal",
    label: "モーダル・シートの個別実装（fixed inset-0）",
    source: "DESIGN_SYSTEM.md §6",
    why: "共通のモーダル部品が無く、各所で背景・閉じ方・フォーカス制御を個別に書いている",
    pattern: /\bfixed inset-0\b/g,
    scope: (f) => f.kind === "own" && /\.tsx$/.test(f.path),
    countMode: "files",
  },
  {
    id: "directSupabaseClient",
    label: "Supabase クライアントの個別生成",
    source: "CLAUDE.md 共通化",
    why: "@supabase/supabase-js の createClient を各所で直に呼ぶと、権限（anon / service role）やオプションの指定が場所ごとに食い違う",
    pattern: /import\s*\{[^}]*\bcreateClient\b[^}]*\}\s*from\s*["']@supabase\/supabase-js["']/g,
    scope: (f) =>
      f.kind === "own" &&
      !f.path.startsWith("lib/supabase/") &&
      !f.path.startsWith("utils/supabase/") &&
      !f.path.startsWith("scripts/"),
    countMode: "files",
  },
  {
    id: "inlineAdminCheck",
    label: "管理者チェックの直書き",
    source: "CLAUDE.md 共通化（認可チェック）",
    why: "authorizeAdmin / requireAdminApi を使わず isAdmin(getRole(...)) を直に書いている API。認可の漏れ・食い違いの温床",
    pattern: /isAdmin\(\s*getRole\(/g,
    scope: (f) => f.kind === "own" && f.path.startsWith("app/api/"),
    countMode: "files",
  },
  {
    id: "inlineCacheControl",
    label: "Cache-Control の直書き",
    source: "CLAUDE.md 共通化（API レスポンス整形）",
    why: "キャッシュ方針が API ごとの文字列に散らばると、公開範囲や秒数の見直しが漏れる",
    pattern: /["']Cache-Control["']\s*:/g,
    scope: (f) => f.kind === "own" && f.path.startsWith("app/"),
    countMode: "files",
  },
  {
    id: "useClientInUi",
    label: "components/ui の \"use client\"",
    source: "DESIGN_SYSTEM.md §5",
    why: "バレル経由でサーバーコンポーネントから読まれたときに壊れる",
    pattern: /^\s*["']use client["']/gm,
    scope: (f) => f.kind === "own" && f.path.startsWith("components/ui/"),
    countMode: "files",
  },
  {
    id: "consoleLog",
    label: "console.log の残留",
    source: ".claude/commands/ship.md",
    why: "デバッグ出力が本番に残る",
    pattern: /\bconsole\.log\(/g,
    scope: (f) => f.kind === "own" && !f.path.startsWith("scripts/"),
    countMode: "matches",
  },
];
