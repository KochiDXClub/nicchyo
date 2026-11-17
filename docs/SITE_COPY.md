# 文言をスプレッドシートで編集する

LP や静的ページの文言の一部は、コードを触らずに Google スプレッドシートで直せる。
直した内容は毎朝（または手動実行で）取り込まれ、develop 向けの PR になる。PR をマージすると次のリリースで本番に出る。

シート：[nicchyo サイト文言](https://docs.google.com/spreadsheets/d/1xR3Fn4-ky7Dtlp0FhyceO-llRWUimVHC521JnoL5qZo/edit)（編集するには、オーナーに編集者として追加してもらう）

```
スプレッドシート ──(毎朝6時 / 手動)──▶ GitHub Actions ──▶ 取り込み PR ──(マージ)──▶ develop ──(リリース)──▶ 本番
                                        検証して JSON に書き出す
```

今シートで編集できるページ：

| タブ | ページ | ID の頭 | 対象 |
|---|---|---|---|
| FAQページ | FAQ（/faq） | `faq.` | 見出し・タブ名・検索結果の説明文 |
| FAQ | FAQ（/faq） | （質問ごとの ID） | 質問と回答（1行1問） |
| LP | LP（/about） | `about.` | 各スライドの見出し・説明・ボタン名・中の項目、ページの説明文 |
| マップ案内 | マップの案内（/map?panel=intro） | `mapIntro.` | 冒頭の見出しと紹介文、にちよさんの一言、相談デモの受け答え、締めの文 |
| トップページ | トップページ（/） | `landing.` | 最初の画面の見出し・ボタン・検索欄、各セクションの見出し、使い方の見本の中身、開催のご案内、日曜市のいいところ、nicchyo について、ページの説明文 |

スライドや項目の **数・順番・アイコン・リンク先・画像** はコードで決めている。シートで行を足しても項目は増えない（増やしたいときは開発者に頼む）。

## 文言を直す人へ

1. スプレッドシートの該当セルを書き換える
2. 急ぐときは GitHub の Actions →「Sync site copy」→「Run workflow」で今すぐ取り込める（待てば毎朝6時に自動で取り込まれる）
3. 「chore: スプレッドシートの文言を取り込む」という PR ができるので、変更箇所とプレビューを確認してマージしてもらう

### シートの書き方

**文言のタブ（FAQページ / LP / マップ案内 / トップページ）**：1行が1つの文言。

| 場所 | 項目 | 文言 | 最大文字数 | ID（変更不可） |
|---|---|---|---|---|
| 1枚目 はじめに | 見出し | nicchyo | | about.intro.title |

- 直すのは **「文言」列だけ**。「場所」「項目」は、どこの文言かを知るための目印（取り込まれない）
- **「ID（変更不可）」の列は書き換えたり消したりしない**（コードが文言を探す名前。消すと取り込みが止まる）。灰色の列で、触ろうとすると警告が出る
- 「最大文字数」は空欄でもよい。書いておくと、超えたときに取り込みが止まる
- 太字にしたいところは `**毎週日曜**` のように `**` で囲む（太字が効くのは `mapIntro.lead` など、もともと太字があった文言だけ）

**「FAQ」タブ**：1行が1つの質問。

| 表示順 | 表示 | カテゴリ | 質問 | 回答 | ID（変更不可） |
|---|---|---|---|---|---|
| 1 | TRUE | map | マップは無料で使えますか？ | はい、すべての機能を… | map-free |

- ページには **「表示順」の小さい順**に並ぶ（空欄は最後、同じ値は上の行が先）
- 「表示」を `FALSE` にすると、行を消さずにページから隠せる（空欄・`TRUE` は表示）。隠した行は下書きとして置いておける（中身の検証もされない）
- カテゴリは `map` / `favorites` / `account` / `general` のどれか（プルダウンから選ぶ）
- 質問を足すときは、新しい行に **他と重ならない ID**（小文字英数字とハイフン）を付ける

**どの文言も共通**：「リンクを知っている全員が閲覧可」のシートなので、外に出せないことは書かない。

### シートの「サイト管理」メニュー（任意）

シートを開いたときに「サイト管理」メニューが出る。

- **文言を取り込む（PR を作る）**：GitHub を開かずに取り込みを始められる（Actions の「Run workflow」と同じ）。本番には出ない。PR のマージは今までどおり人が行う
- **コードの文言をシートに足す**：開発者がコードに新しい文言を足したあと（develop にマージされたあと）に押す。シートに無い ID の行だけを、決まったタブのいちばん下に足す（タブが無ければ、見出し・灰色の ID 列・保護つきで作る）。今ある行の文言は書き換えない。トークンは要らない

コードは `scripts/site-copy/apps-script/Code.gs`。`Code.gs` が変わったら、Apps Script に貼り直す。設定は1回だけ：

1. GitHub で Fine-grained personal access token を作る（Repository access は `KochiDXClub/nicchyo` だけ、Permissions は Actions: Read and write だけ）
2. シートの「拡張機能 → Apps Script」を開き、`Code.gs` の中身を貼り付けて保存する
3. 「プロジェクトの設定 → スクリプト プロパティ」に `GITHUB_TOKEN` として 1 のトークンを入れる（コードには書かない）
4. シートを開き直すと「サイト管理」メニューが出る。初回は Google の権限確認が出る

トークンは、このシートの **編集者なら Apps Script から読める**。編集者はチームの人だけにする。期限が切れたら作り直して `GITHUB_TOKEN` を入れ替える。

### 取り込みが止まったとき

Actions の「Sync site copy」の実行ログに、直すべきセルが「◯行目」の形で並ぶ。1件でも問題があると何も取り込まれない（サイトは今のまま）。
よくある原因：空欄、ID の重複、存在しないカテゴリ、数字でない表示順、HTML タグ（`<b>` など。効かないので書けない）、太字の `**` の閉じ忘れ、最大文字数超え。

## 開発者向け

### 仕組み

- 文言の実体は `content/site-copy/texts.json`（key → 文言）と `content/site-copy/faq.json`（FAQ の配列）。どちらもシートから生成するので **直接編集しない**（次の取り込みでシートの内容に戻る）
- コードからは `siteText("faq.title")`（`lib/siteCopy.ts`）で読む。key は JSON から型が付くので、打ち間違えるとビルドで止まる。太字を含む文言は `siteTextWithEmphasis(key, className)`
- 取り込みは `scripts/site-copy/sync.mjs`。シートを CSV で読み、検証して JSON を書く。サイトで使っている key がシートから消えていたら止める
- 「どのタブの、どの場所の、何の文言か」は `scripts/site-copy/layout.mjs`（key → タブ・場所・項目）で決める。シートの「場所」「項目」列はここから作る（取り込みでは読まない）
- `content/site-copy/sheet-layout.json` は `layout.mjs` から作る key ごとの置き場所。シートのメニュー（Apps Script）は `layout.mjs` を動かせないので、これを develop から読む。取り込みのたびにも作り直される
- 実行時には Google にアクセスしない。ページは今までどおり静的に配信される

### 新しい文言をシートに移す

1. key と今の文言を `texts.json` に足し、コードの直書きを `siteText("about.intro.title")` に置き換える
2. `layout.mjs` に、その key の置き場所（場所・項目）を足す。知らない key は「場所」が「その他」になる（取り込みには影響しないが、テストで止まる）
3. `node scripts/site-copy/sync.mjs --layout` で `content/site-copy/sheet-layout.json` を作り直す（忘れると `sync.test.ts` が落ちる）。PR を出す
4. PR が develop にマージされたら、シートの「サイト管理 → コードの文言をシートに足す」を押す。**押すまで、毎朝の取り込みは「ID がシートにありません」で止まる**（サイトは今のまま）
5. 新しいページ（`faq.` `about.` `mapIntro.` `landing.` 以外）の文言を足すときは、`layout.mjs` の `TEXT_TABS` にタブを足す（シートのタブは 4 のメニューが作る）

key を消すときは、先にコードから使うのをやめてから JSON とシートの行を消す。

### 最初の設定（1回だけ）

1. 今の JSON をシート貼り付け用の CSV に書き出す：`node scripts/site-copy/sync.mjs --export site-copy-export`（タブごとに `FAQページ.csv` `FAQ.csv` `LP.csv` `マップ案内.csv` `トップページ.csv` ができる）
2. Google スプレッドシートを作り、シート名を CSV のファイル名と同じにして、それぞれに CSV を読み込む。ID の列は灰色にして、保護（警告）をかけておく
3. 共有設定を「リンクを知っている全員」→「閲覧者」にする。編集者はチームの人だけを個別に追加する
4. GitHub のリポジトリ設定で
   - Settings → Secrets and variables → Actions → **Variables** に `SITE_COPY_SHEET_ID`（シート URL の `/d/` と `/edit` の間の文字列）を追加
   - Settings → Actions → General → 「Allow GitHub Actions to create and approve pull requests」をオンにする
5. Actions の「Sync site copy」を手動実行し、「変更なし」で終わることを確かめる

手元で試すときは `SITE_COPY_SHEET_ID=<ID> node scripts/site-copy/sync.mjs`。
