# 文言をスプレッドシートで編集する

LP や静的ページの文言の一部は、コードを触らずに Google スプレッドシートで直せる。
直した内容は毎朝（または手動実行で）取り込まれ、develop 向けの PR になる。PR をマージすると次のリリースで本番に出る。

シート：[nicchyo サイト文言](https://docs.google.com/spreadsheets/d/1xR3Fn4-ky7Dtlp0FhyceO-llRWUimVHC521JnoL5qZo/edit)（編集するには、オーナーに編集者として追加してもらう）

```
スプレッドシート ──(毎朝6時 / 手動)──▶ GitHub Actions ──▶ 取り込み PR ──(マージ)──▶ develop ──(リリース)──▶ 本番
                                        検証して JSON に書き出す
```

今シートで編集できるページ：

| ページ | key の頭 | 対象 |
|---|---|---|
| FAQ（/faq） | `faq.` と「FAQ」シート | 見出し・説明文・質問と回答 |
| LP（/about） | `about.` | 各スライドの見出し・説明・ボタン名・中の項目、ページの説明文 |
| マップの案内（/map?panel=intro） | `mapIntro.` | 冒頭の見出しと紹介文、にちよさんの一言、相談デモの受け答え、締めの文 |

スライドや項目の **数・順番・アイコン・リンク先・画像** はコードで決めている。シートで行を足しても項目は増えない（増やしたいときは開発者に頼む）。

## 文言を直す人へ

1. スプレッドシートの該当セルを書き換える
2. 急ぐときは GitHub の Actions →「Sync site copy」→「Run workflow」で今すぐ取り込める（待てば毎朝6時に自動で取り込まれる）
3. 「chore: スプレッドシートの文言を取り込む」という PR ができるので、変更箇所とプレビューを確認してマージしてもらう

### シートの書き方

**「文言」シート**：1行が1つの文言。

| key | 文言 | 最大文字数 | 備考 |
|---|---|---|---|
| faq.title | よくある質問 | 20 | ページの見出しと、ブラウザのタブ名 |

- `key` はコードが文言を探す名前。**書き換えたり消したりしない**（消すと取り込みが止まる）
- `最大文字数` は空欄でもよい。書いておくと、超えたときに取り込みが止まる
- 太字にしたいところは `**毎週日曜**` のように `**` で囲む（太字が効くのは `mapIntro.lead` など、もともと太字があった文言だけ）
- `備考` は取り込まれない。ただし **シートは「リンクを知っている全員が閲覧可」なので、外に出せないことは書かない**

**「FAQ」シート**：1行が1つの質問。上の行から順にページに並ぶ。

| id | カテゴリ | 質問 | 回答 |
|---|---|---|---|
| map-free | map | マップは無料で使えますか？ | はい、すべての機能を… |

- `id` は他と重ならない名前（小文字英数字とハイフン）。質問を足すときは新しい id を付ける
- `カテゴリ` は `map` / `favorites` / `account` / `general` のどれか
- 行を消せばその質問はページから消える

### 取り込みが止まったとき

Actions の「Sync site copy」の実行ログに、直すべきセルが「◯行目」の形で並ぶ。1件でも問題があると何も取り込まれない（サイトは今のまま）。
よくある原因：空欄、key や id の重複、存在しないカテゴリ、HTML タグ（`<b>` など。効かないので書けない）、太字の `**` の閉じ忘れ、最大文字数超え。

## 開発者向け

### 仕組み

- 文言の実体は `content/site-copy/texts.json`（key → 文言）と `content/site-copy/faq.json`（FAQ の配列）。どちらもシートから生成するので **直接編集しない**（次の取り込みでシートの内容に戻る）
- コードからは `siteText("faq.title")`（`lib/siteCopy.ts`）で読む。key は JSON から型が付くので、打ち間違えるとビルドで止まる。太字を含む文言は `siteTextWithEmphasis(key, className)`
- 取り込みは `scripts/site-copy/sync.mjs`。シートを CSV で読み、検証して JSON を書く。サイトで使っている key がシートから消えていたら止める
- 実行時には Google にアクセスしない。ページは今までどおり静的に配信される

### 新しい文言をシートに移す

1. シートの「文言」に行を足す（例：`support.hero.title`）
2. 同じ key と文言を `texts.json` に足し、コードの直書きを `siteText("support.hero.title")` に置き換えて PR を出す
3. 以後はシートで編集できる

key を消すときは、先にコードから使うのをやめてから JSON とシートの行を消す。

### 最初の設定（1回だけ）

1. 今の JSON をシート貼り付け用の CSV に書き出す：`node scripts/site-copy/sync.mjs --export site-copy-export`
2. Google スプレッドシートを作り、シート名を「文言」「FAQ」にして、それぞれに CSV を読み込む
3. 共有設定を「リンクを知っている全員」→「閲覧者」にする。編集者はチームの人だけを個別に追加する
4. GitHub のリポジトリ設定で
   - Settings → Secrets and variables → Actions → **Variables** に `SITE_COPY_SHEET_ID`（シート URL の `/d/` と `/edit` の間の文字列）を追加
   - Settings → Actions → General → 「Allow GitHub Actions to create and approve pull requests」をオンにする
5. Actions の「Sync site copy」を手動実行し、「変更なし」で終わることを確かめる

手元で試すときは `SITE_COPY_SHEET_ID=<ID> node scripts/site-copy/sync.mjs`。
