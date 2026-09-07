# リリース運用方針

nicchyo の本番リリース（`develop` → `main`）をいつ・どうやって行うかを定めた文書。

> **この方針はまだ適用されていない。** 適用には後述の「初回リリース（v1.4）への移行手順」の実施が必要で、
> レビュー中のPRが片付いてから着手する。現状は「本番は2026-05-20時点で固定」のまま。

---

## 1. ブランチとデプロイの対応

| ブランチ | 役割 | デプロイ先 |
|---|---|---|
| `feature/*` · `worktree-*` | 個別作業 | Vercel Preview（PRごと） |
| `develop` | 統合先。常に「次のリリース候補」 | Vercel Preview（`nicchyo-git-develop-*.vercel.app`） |
| `main` | **本番**。今まさに来訪者が見ているコード | Vercel Production（`nicchyo.vercel.app`） |

- `main` へのマージ = リリース = 本番反映。`main` を戻せば本番が戻る。
- `develop` は本番ではない。develop にマージしても来訪者には届かない。

### 移行前の実態（2026-08-13 時点の記録）

この方針を作った時点では上記になっていなかった。記録として残す。

- 本番 `nicchyo.vercel.app` は **2026-05-20 に develop の `566afc9`（PR #282 = v1.3のfix）を手動 redeploy したもの**。以後 3ヶ月弱、本番は更新されていない。
- `develop` への push はすべて Preview 扱い（`target: null`）で、本番には反映されていなかった。
- `main` の最終更新は 2026-05-19（v1.3 / PR #278）。以後マージなし。
- その結果、`develop` が `main` より 778 コミット先行（373ファイル、+21,771 / -11,710行）した状態になった。

**なぜ滞留したか**：`main` に役割が定義されておらず（本番でも開発でもない）、
かつリリース判断が「区切りが良くなったら」という曖昧な基準で、
本番更新が手作業だったため。この3つを解消するのが本方針の目的。

---

## 2. リリースの単位

**`develop` → `main` のマージ1回 = 1リリース = バージョン `v1.x` 1つ**。

リリースごとに以下を行う（手順は §4）。

- `app/about/versions.ts` の `versionHistory` 先頭に来訪者向けの要約を追記
- `git tag v1.x` を打つ
- マージコミットのタイトルは `verX.Y: <概要> / Develop (#PR番号)`（既存の慣習を踏襲）

---

## 3. リリースのトリガー

以下のどちらか**早い方**に達したらリリースする。

### (a) mini-project または期限付き epic が1つ完了したとき

Projects「nicchyo タスク管理」で、完了しうる上流タスクが1つ閉じたタイミング。

該当するもの（2026-08-13 時点）:

| Issue | 種別 | リリース単位になるか |
|---|---|---|
| #499 バッグ廃止・お気に入り機能拡張 | epic（期限付き） | ○ |
| #470 出店者⇔運営/市役所 連絡機能 | mini-project | ○ |
| #463 セキュリティチェック体制の整備 | mini-project | ○ |
| #462 ガイドライン/免責事項整備 | mini-project | ○ |
| #461 360度カメラ撮影データのマップ配置 | mini-project | ○ |
| #455〜#460（マップ / 相談 / 近況 / 出店者 / 管理者 / 全体基盤） | epic（恒久） | **×** |

**注意**: #455〜#460 は5機能軸の恒久的な受け皿なので構造上完了しない。
これらの epic の完了をリリーストリガーにしてはいけない。

### (b) 前回リリースから4週間経過したとき

(a) の区切りが来ないまま4週間経ったら、その時点の `develop` をそのままリリースする。
**これは滞留の安全弁で、省略しない。** 今回3ヶ月止まった原因が「区切り待ち」だったため。

### リリース作業を行う曜日

**金曜に実施し、土曜・日曜はリリースしない。**

日曜市は毎週日曜開催で、日曜が事実上の本番稼働日。当日および前日に本番を動かさない。

| 曜日 | 扱い |
|---|---|
| 月〜木 | 通常開発。`develop` へのマージ可 |
| 金 | リリース日（トリガー条件を満たしていれば） |
| 土 | 本番確認のみ。リリースしない |
| 日 | **凍結**。§6 の hotfix のみ |

---

## 4. リリース手順

1. **トリガー条件の確認** — §3 の (a) または (b) を満たしているか。曜日が金曜か。
2. **レビュー中PRの整理** — マージ予定のPRは先に `develop` へ入れる。間に合わないPRは次回リリースに回す。
3. **`develop` の CI 通過を確認** — lint / tsc / test / build（`.github/workflows/ci.yml`）。
4. **リリースPRを作成** — `develop` → `main`。タイトルは `verX.Y: <概要> / Develop (#PR番号)`。
5. **Preview で通し確認** — リリースPRの Preview URL で以下を実機確認する。ビルドが通ることは動作の保証にならない。
   - マップ（`/map`）: 店舗マーカー表示・ズーム・道の描画・店舗詳細バナー
   - 検索（`/search`）
   - AI相談（`/consult`）: 「にちよさん」が応答するか
   - 近況（story）
   - 出店者ページ（`/my-shop`）
   - 管理画面（`/admin`）: 主要画面が開くか
6. **`app/about/versions.ts` を更新** — `versionHistory` の先頭に新エントリを追加。来訪者から見て何が変わったかを3〜5件で書く（開発の詳細はコミットに残るので書かない）。
7. **マージ** — `main` へ。Vercel が Production へ自動デプロイする。
   リリースに `supabase/migrations/` の変更が含まれていれば、同時に GitHub Actions
   `Migrations Deploy (Production)` が起動し、Environment `production` の承認を待つ（§9）。
   **Actions タブで内容（dry run の差分）を確認して承認する**。承認後、本番 Supabase に未適用分が適用される。
8. **本番確認** — `nicchyo.vercel.app` で §5 の項目を再確認。マイグレーションがあった場合は Actions の
   `Migration status (after)` でリポジトリと本番の履歴が揃っていることも確認する。
9. **タグを打つ** — `git tag v1.x && git push origin v1.x`。
10. **`main` を `develop` に取り込む** — マージ方式の差でズレが残らないよう `main` → `develop` を戻しマージする。

---

## 5. hotfix（本番の緊急修正）

日曜市当日など、次のリリースを待てない不具合が出た場合。

1. `main` から `hotfix/<内容>` を切る
2. 修正はその不具合に限定する（他の変更を混ぜない）
3. `main` へPRを出してマージ → 本番反映
4. 同じ内容を `develop` にも入れる（`main` → `develop` の戻しマージ）
5. バージョンは `v1.x.1` のようなパッチ番号にする

`develop` から hotfix を切ってはいけない。未リリースの変更を巻き込んでしまう。

---

## 6. 未リリース変更の記録

`docs/CHANGELOG-unreleased.md` に、**develop へマージするPRごとに1行**追記する。

```markdown
- 日曜市カレンダーに出店予定と旬を表示するようにした (#444)
```

- 書くのは**来訪者から見て何が変わったか**の一言。実装の詳細はコミットに残るので書かない。
- 来訪者に見えない変更（依存更新・テスト追加・リファクタ・ドキュメント）は書かなくてよい。
- 追記は `/ship` の手順に含まれる。PR作成時に一緒に入れる。

この記録には2つの役目がある。

1. **リリースノートが書ける** — リリース時にこのファイルを `app/about/versions.ts` へ転記して空にする。
   778コミットを後から遡って要約する作業（今まさに発生している負債）が二度と起きない。
2. **溜まり具合が見える** — 行数が増えていくこと自体がリリース時期の圧力になる。

`.github/workflows/release-reminder.yml` が毎週金曜9時（JST）にこのファイルの行数と
前回リリースからの経過日数を見て、§3 の条件を満たしていればリリース確認の Issue を立てる。
このワークフローは `v1.*` タグが存在するときだけ動く（初回リリース後に自動で有効になる）。

---

## 7. 初回リリースへの移行手順

**着手条件**: レビュー中のPR（#479 マップ編集v3 1/3、#492 map-spec更新、#408 README）が
マージまたはクローズされていること。レビュー往復中の変更を含んだまま3ヶ月分を本番へ出さない。

3ヶ月分（778コミット）は **v1.4 / v1.5 の2段に分けて出す**。

| | 範囲 | 境界コミット | 主な内容 |
|---|---|---|---|
| **v1.4** | `main` 〜 2026-07-25 | `61ecc1f`（PR #399） | セキュリティ・RLS強化、クーポン機能とことづてページの削除、マップUX・ズーム改善、AI相談の品質改善、近況機能、おでかけサポート（近隣探索）、管理者機能（RBAC・報告・問い合わせ・設定） |
| **v1.5** | 2026-07-26 〜 現在 | `develop` HEAD | 日曜市カレンダー、おでかけサポート拡充、管理者ロール統合・一斉メール、RLS追加強化、バッジ/レシピ/ことづて/出店状況投票の削除、about ページ刷新、マップ編集v3 |

### なぜこの境界か

- 7/25 と 8/06 の間に11日の活動空白があり、開発の区切りと一致する。
- **6月末で3分割してはいけない。** 図鑑機能（`feature/encyclopedia-base`）が6月に追加され
  7月に削除（`feature/remove-encyclopedia`）されているため、6月末で切ると
  本番に図鑑が一度現れてすぐ消える。7/25 で切れば追加と削除が v1.4 内で完結する。
- マイグレーションも境界で綺麗に分かれる（v1.4: `20260613`〜`20260719`、v1.5: `20260806`〜`20260807`）。
- `git merge <境界SHA>` を順に行うだけで済み、cherry-pick は不要。履歴の組み替えが発生しない。

### 手順

1. **Vercel の Production Branch を `main` に明示設定する**（Vercel ダッシュボード → nicchyo → Settings → Git）。
   これは手動作業。設定だけでは再デプロイは走らないので、この時点で本番は変わらない。
2. **本番 Supabase のマイグレーション適用状況を確認する。** 上記マイグレーションが本番DBに
   適用済みかを確認する（関連: #425）。コードだけ進んでテーブルが無い状態を作らない。
   手順は §9「初回セットアップ」。ここで履歴を揃えておけば、以降のリリースでは自動適用に任せられる。
3. **v1.4 をリリースする** — `main` へ `61ecc1f` をマージするPRを作成。
   - **`main` には squash マージ由来のコミット `33c2b56`（v1.3）が1つあり `develop` に存在しない。**
     内容は develop 由来なのでコンフリクトが起きうる。起きた場合は develop 側（新しい方）を採用する。
   - §4 の手順5（Preview 通し確認）→ `versions.ts` に v1.4 追記 → マージ → 本番確認 → `git tag v1.4`
4. **v1.5 をリリースする** — v1.4 の本番確認が済んでから、`develop` → `main` のリリースPRを作成。
   同様に確認 → `versions.ts` に v1.5 追記 → マージ → `git tag v1.5`
5. `main` → `develop` の戻しマージ
6. `docs/CHANGELOG-unreleased.md` を空にする
7. 以降は §3 のトリガーと §6 の記録に従って運用する

---

## 8. 参考

- CI: `.github/workflows/ci.yml`（`develop` / `main` への push とPRで lint・tsc・test・build）
- マイグレーション検証: `.github/workflows/migrations-check.yml`（§9）
- マイグレーション本番適用: `.github/workflows/migrations-deploy.yml`（§9）
- バージョン履歴の実体: `app/about/versions.ts` → `/about/versions` で公開
- Vercel プロジェクト: `nicchyo`（本番）。旧 `nicchyo-platform` は使用していない
- デプロイ状況の確認: `/deploy-check`

---

## 9. DBマイグレーションの自動適用

`supabase/migrations/` の SQL は GitHub Actions で検証・適用する。手で `supabase db push` を叩かない。

### 流れ

```
PR（→ develop）        Migrations Check   : まっさらなローカルPostgresに全マイグレーションを頭から適用。
                                            本番には触らない。落ちたらマージしない。
main にマージ（=リリース） Migrations Deploy  : 本番 Supabase に未適用分だけを順に適用。
                                            Environment `production` の承認を挟む。
```

- 適用済みかどうかは Supabase 側の `supabase_migrations.schema_migrations` で管理される。
  同じファイルが二度適用されることはない。
- `develop` へのマージでは本番に適用しない。本番DBは1つしかないため、未リリースのコードが前提の
  スキーマ変更を先に本番へ入れないようにしている。
- ロールバックは自動化しない。失敗時は Actions のログを見て、修正マイグレーションを追加して対処する。

### マイグレーションを書くときのルール

アプリのデプロイ（Vercel）とDBの適用（Actions）は `main` への push で**並走**し、順序は保証されない。
そのため、マイグレーションは**後方互換**（旧コードでも動く）にする。

- 追加系（`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`）を基本にする
- カラム削除・リネーム・NOT NULL 追加は、先にコード側の参照を外してリリースし、次のリリースで消す（expand → contract）
- 破壊的変更を1リリースで済ませたい場合は、リリースPRに明記し、Actions の承認を**先に**してから Vercel の
  デプロイを確認する運用で凌ぐ

### 初回セットアップ（1回だけ・要 Supabase 管理者権限）

1. **GitHub Environment `production` を作る** — Settings → Environments → New environment。
   Deployment protection rules で **Required reviewers** を設定する（承認者はリリース担当者）。
2. **Environment secrets を登録する**（Repository secrets ではなく Environment 側に入れる）
   - `SUPABASE_ACCESS_TOKEN` — https://supabase.com/dashboard/account/tokens で発行
   - `SUPABASE_PROJECT_ID` — 本番プロジェクトの Reference ID（Settings → General）
   - `SUPABASE_DB_PASSWORD` — 本番DBパスワード（Settings → Database）
3. **本番の適用履歴とリポジトリを揃える**（#425 の調査とセットで行う）
   ```bash
   npx supabase link --project-ref <本番 project ref>
   npx supabase migration list        # Local と Remote の差分を見る
   ```
   - 本番に手で適用済みなのに Remote 側に記録が無いものは、履歴だけ埋める:
     `npx supabase migration repair --status applied <version>`
   - 本番に存在しない変更（本当に未適用）はそのまま残す → 次のリリースで自動適用される
   - `20260414081611_remote_schema.sql` のように本番を直接いじった痕跡があるものは、
     内容を読んで「本番には反映済み」と判断できれば `applied` にする
4. **dry run で確認する** — Actions → `Migrations Deploy (Production)` → Run workflow（`dry_run` = true）。
   `Migration status (before)` と `Dry run` の出力が期待どおりか見る。
5. 問題なければ以降は `main` マージごとに自動で起動する。数回運用して不安がなくなったら
   Required reviewers を外して全自動にしてよい。

### うまくいかないとき

**`Migrations Deploy (Production)` が一瞬で失敗する / `main` 以外のブランチでも走る**

Actions の一覧で、実行名がワークフロー名ではなく `.github/workflows/migrations-deploy.yml`
とファイルパスで出ていて、ジョブが1つも無く、所要時間が0秒なら、ワークフロー定義の
検証に失敗している（startup failure）。この状態では `on:` のブランチ絞り込みも効かず、
あらゆる push で失敗ランが積まれる。

よくある原因は、使えないコンテキストを参照していること。特に `environment.url` では
`secrets` が使えない（使えるのは `github` / `inputs` / `vars` / `needs` / `strategy` /
`matrix` / `job` / `runner` / `env` / `steps`）。Secrets を出したいときはステップの中で使う。

**本番の適用履歴とリポジトリがずれた**

手で SQL を流した、MCP など Actions 以外の経路で適用した、といった場合に起きる。
ずれたまま `db push` が走ると、適用済みのマイグレーションを再実行して失敗する
（`create policy` の重複、削除済みカラムの参照など）。

1. `npx supabase migration list --linked` で Local と Remote の差分を見る
2. **本番に反映済みなのに記録が無いもの** — 中身を読んで反映済みだと確認してから
   `npx supabase migration repair --status applied <version>`
3. **記録があるのに本番に反映されていないもの** — `--status reverted` で戻してから
   次のリリースで適用させる
4. Actions 以外で適用した変更は、同じ内容の `.sql` をリポジトリにも追加する。
   このときファイル名のタイムスタンプを**本番の記録と同じ version に合わせる**と、
   `db push` が「適用済み」と判定して二重実行を避けられる

### 補足

- `migrations-check.yml` は `supabase/migrations/**` を触ったPRでしか走らない。ブランチ保護の
  必須チェックには入れない（走らないPRで pending のままになるため）。
- リポジトリに `supabase/config.toml` は置いていない。CI 内で `supabase init` して生成している。
  ローカルで `npx supabase start` するときは各自の手元の config.toml が使われる。
