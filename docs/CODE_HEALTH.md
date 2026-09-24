# コード健康診断

共通基盤（`lib/`・`components/`）が育っているか、同じものを2回作っていないか、
CLAUDE.md・DESIGN_SYSTEM.md で決めた書き方から外れていないかを**数えて**確かめる仕組み。

「ビルドと lint は通るが、共通部品を使わずに個別実装した」という変更は目では見落としやすい。
そこで変更前後の数値を並べ、悪化したら場所まで示す。

## 使い方

```bash
npm run code-health        # 今のコードを測る → .code-health/report.html
npm run code-health:diff   # develop との分岐点と比べる（悪化があれば終了コード 1）
```

- `.code-health/report.html` をブラウザで開くと、ツリーマップ・目標との比較・コピペ一覧が見られる
- `code-health:diff` の結果は `.code-health/diff.md` にも出る。PR 本文の「共通基盤チェック」欄にそのまま貼る
  （結論1行・主要指標と変化した項目だけの表・悪化した箇所・理由欄。全項目は折りたたみの中）
- 比較相手が古いときは先に `git fetch origin develop` する
- PR では CI（Lint / Type Check / Test / Build）が同じ比較をして、ジョブのサマリーに表を出す（今は失敗扱いにしない）

## AI・人が開発するときの流れ

1. 作業を始める前に `npm run code-health` を実行し、触る場所の状態を見ておく
   （ツリーマップの「コピペの割合」「ルール違反の数」で、その辺りに既存の共通部品や重複がないかを確かめる）
2. 実装する。**同じ処理を書こうとしたら、先に `lib/`・`components/ui/` に同じものがないか探す**
3. PR を出す前に `npm run code-health:diff` を実行する
   - ✅ なら `.code-health/diff.md` を PR 本文の「共通基盤チェック」欄に貼る
   - ⚠️ なら「悪化した箇所」を直す。直さない理由があるときは、同じ欄の「悪化を残す理由・今後の対応」に書く
     （例: 既存の重複を1か所へ移しただけで総量は変わらない、など）

## ものさし

定義は `scripts/code-health/rules.mjs` にある。足したいルールはここに1件足せば、集計・比較・レポートに自動で載る。

### 全体の指標（目標値は「最適な状態」の目安）

| 指標 | 目標 | 意味 |
|---|---|---|
| 共通化率 | 30%以上 | アプリ本体（テスト・型・生成物を除く）のうち `lib/`・`components/`・`utils/` の割合 |
| コピペ率 | 3%以下 | 意味のある行が8行以上そっくり同じ並びで、別の場所にもある行の割合 |
| 巨大ファイル | 10件以下 | 空行を除いて600行を超える自作ファイル |
| 同名の部品 | 0組 | 別々のディレクトリに同じ名前の `.tsx` 部品がある（2回作っている候補） |

目標値は業界の一般的な目安と、今の nicchyo の規模から置いた仮の値。運用しながら見直してよい。

### 書き方のルール（増やさない・減らしていく）

| ルール | 根拠 |
|---|---|
| 生の hex カラー（種類） | DESIGN_SYSTEM.md §5 |
| `slate-*` / `gray-*` | DESIGN_SYSTEM.md §3 |
| 角丸の直書き（`rounded-xl` など） | DESIGN_SYSTEM.md §3 |
| グラデーション（種類） | DESIGN_SYSTEM.md §5 |
| モーダル・シートの個別実装（`fixed inset-0`） | DESIGN_SYSTEM.md §6 |
| Supabase クライアントの個別生成 | CLAUDE.md 共通化（`lib/supabase/`・`utils/supabase/` 以外で `createClient` を直に import） |
| 管理者チェックの直書き | CLAUDE.md 共通化（`isAdmin(getRole(...))` を API に直書き） |
| `Cache-Control` の直書き | CLAUDE.md 共通化（API レスポンス整形） |
| `components/ui` の `"use client"` | DESIGN_SYSTEM.md §5 |
| `console.log` の残留 | `/ship` |

## 分類のしかた

- **種類**: テスト（`*.test.*`・`tests/`）/ 自動生成（`database.types.ts`・`@generated`）/
  データ（`data/` 配下・sample / mock / demo）/ それ以外が自作
- **機能**: `page.tsx` などの Next.js 規約ファイル = ページ、`app/` 内のそれ以外の `.tsx` = ページ専用UI、
  `.ts` = ページ専用ロジック、`app/api/` と `proxy.ts` = API、`components/` = 共通UI、`lib/`・`utils/` = 共通ロジック
- 行数は空行を除いて数える。コピペ判定ではコメント・import・閉じ括弧だけの行も除く

## 限界

- コピペ検出は「そっくり同じ並び」だけを拾う。変数名だけ違う重複や、書き方が違うが同じことをしている重複は拾えない。
  そこは人（や AI のレビュー）が見る。ルールに足せるものは `rules.mjs` に足す
- 数値が良くなることが目的ではない。数値は「どこを見ればよいか」の目印として使う
