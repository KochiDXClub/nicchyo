# リリース運用方針

nicchyo の本番リリース（`develop` → `main`）をいつ・どうやって行うかを定めた文書。

> **この方針はまだ適用されていない。** 適用には後述の「初回リリース（v1.4）への移行手順」の実施が必要で、
> レビュー中のPRが片付いてから着手する。現状は「本番は2026-05-20時点で固定」のまま。
>
> **2026-10-07 時点の確認**: `origin/main` は依然 v1.3（`33c2b56`）で `v1.*` タグも無く、未適用のまま。
> `develop` は `main` より 1903 コミット先行し、直接マージすると 57 件コンフリクトする。マイグレーションは
> `main` に無いものが 74 本あり、DROP を含む不可逆なものが混じる。着手するときは **§4（特に §4.1〜§4.2）を先に読む**。
> §7 の v1.4 / v1.5 分割の表は 2026-08-13 時点の見込みなので、そのまま使わず取り直すこと。
> なお、この間に増えた仕組み: 本番デプロイ時のコード健康診断の保存（[CODE_HEALTH.md](./CODE_HEALTH.md)）、
> スプレッドシート文言の取り込みPR（[SITE_COPY.md](./SITE_COPY.md)）。

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

> **前提知識（2026-10-07 時点のレビューで判明したこと）**
> - `develop` → `main` を GitHub 上でそのままマージすると **57件のコンフリクト**になる
>   （`main` は develop の途中状態を squash した v1.3 の1コミットだけで、履歴が分岐しているため）。§4.1 の手順で先に解消する。
> - このリリースには **DROP を含む不可逆なマイグレーション**が入る（§4.2）。DBは「バックアップからの復元」でしか戻せない。
> - 本番の `main`（v1.3）のコードは、これから削除されるテーブル・カラム（`coupon_*`・`kotodutes`・`vendors.owner_name` など）をまだ使っている。
>   Vercel のデプロイと DB の適用はどちらが先でも旧／新どちらかのコードが壊れるため、**メンテナンスモードで来訪者を止めてから適用する**（§4.4）。

### 4.1 `main` を `develop` に取り込んで、コンフリクトを先に解消する

リリースPR（`develop` → `main`）を作る**前に**、`develop` から作業用ブランチを切って `main` を取り込む。
解消の方針は「main 側の変更は develop に全て含まれている」ことを検証済みなので、**全て develop 側を採用**する。

```bash
git fetch origin
git switch -c release/sync-main origin/develop
git merge origin/main        # コンフリクトが出る（57件前後）
```

| 種類 | 解消方法 |
|---|---|
| content / add-add コンフリクト | すべて develop 側（`git checkout --ours <file>`）。`-X ours` でも同じ |
| modify/delete（develop で削除済み） | **削除側を採用**（`git rm <file>`）。main 側で変更されていても復活させない |
| `package.json` | conflict marker を消し、`@anthropic-ai/sdk` は **`^0.91.1`**（develop 側）にする。`package-lock.json` は develop 側から `npm install` で整合させる |
| `types/database.types.ts` | 自動マージで main 由来の **`redeem_coupon` の型（+11行、廃止済みの関数）が混入する**。削除する |

解消後に **develop と同じ内容になっていることを確認**する（差分が出たら取り込み漏れ・混入）。

```bash
git diff origin/develop --stat   # 空であること（空でなければ中身を読む）
npm run build                    # 通ること
```

- この作業ブランチは人が差分を目視レビューしてから `develop` へPRで入れる（`main` を `develop` へ戻しマージする形になるので、以降 `develop` → `main` は fast-forward に近い形で入る）。
- `types/database.types.ts` を DB から再生成している場合は、`redeem_coupon` が含まれないことを再確認する。

### 4.2 不可逆なマイグレーションの事前確認

`develop` には、`main` に無い約70本のマイグレーションがある。そのうち**データを消すもの・元に戻せないもの**は、
2026-10-07 のレビュー時点で次のとおり（`develop` が進んでいれば増えているので、下のコマンドで取り直す）。

| ファイル | 内容 | 事前に確認すること |
|---|---|---|
| `20260613000000_drop_coupon_feature.sql` | `coupon_*` 6テーブルと `redeem_coupon` を DROP、`system_settings` の `coupon` 行を DELETE | 旧クーポンのデータを残す必要がないか（運営の合意） |
| `20260817211500_drop_kotodutes.sql` | `kotodutes` テーブルを DROP | 同上 |
| `20260817210600_drop_vendors_owner_name.sql` | `vendors.owner_name` を DROP | マイグレーション内で `vendor_owner_profiles`（非公開）へコピーされる。コピー後の件数が `vendors` と合うか |
| `20260817215000_minimize_web_page_analytics.sql` | `web_page_analytics.user_id` を DROP し、同一トランザクションで大量 DELETE（**テーブルに ACCESS EXCLUSIVE ロック**。実行中はページ閲覧の INSERT が止まる） | 実行時間の見込み。必ずメンテナンスモード中に流す |
| `20260911220000_drop_ai_consult_log_question_and_ip.sql` | `ai_consult_logs.question_text` / `ip_address` を DROP | 過去の相談文・IP が不要になることの合意 |
| ほか | `DELETE FROM` による旧データの削除、`REVOKE`（`vendors` の INSERT 剥奪など）、旧機能（バッジ・レシピ・ことづて・出店状況投票）の DROP | 下のコマンドで全件を確認 |

```bash
# main に無い（= このリリースで初めて本番に流れる）マイグレーションのうち、破壊的な文を含むものを列挙する
git diff --name-only --diff-filter=A origin/main...origin/develop -- supabase/migrations \
  | xargs grep -nEi '\b(drop[[:space:]]+(table|column|function|policy|trigger|constraint|type|view|schema)|delete[[:space:]]+from|truncate|revoke)\b' \
  | grep -vE ':[0-9]+:[[:space:]]*--'
```

`Migrations Deploy` の dry-run ジョブも、同じ観点で「破壊的・不可逆になりうる文」を Step Summary に出す。**承認はその一覧を読んでから**押す（§4.4）。

**本番データの事前確認**（Supabase SQL Editor で読み取りのみ。結果を記録する）:

```sql
-- 20261003100000: id が auth.users にある既存 vendors 行は全て「店舗オーナー」として登録される。
-- 0件でなければ、QR 招待（issue_shop_claim_token）が既存分で already_claimed になる。件数と対象を把握しておく
select count(*) from public.vendors v join auth.users u on u.id = v.id;

-- 20261001160000: store_knowledge に title 60文字・content 5000文字の上限制約が付く。超過行が1つでもあるとマイグレーションが失敗する
select id, length(title), length(content) from public.store_knowledge
where length(title) > 60 or length(content) > 5000;

-- 20260906123248: 本番に手で作った public ポリシーに user_metadata を使うものがあると、そのマイグレーションが途中で止まる
select schemaname, tablename, policyname from pg_policies
where schemaname = 'public' and (qual ilike '%user_metadata%' or with_check ilike '%user_metadata%');
```

あわせて `npx supabase migration list --linked` で、**70本のうち本番に手で適用済みのもの**を確認し、履歴を揃える（§9「初回セットアップ」手順3）。
手で適用済みなのに Remote に記録が無いまま流すと、`CREATE POLICY` の重複などで途中停止する（各ファイルは別トランザクションなので、止まった時点で**本番は中途半端な状態**になる）。

### 4.3 本番環境の事前確認

**Vercel の Production 環境変数**（Settings → Environment Variables → Production）に次があること。値は `.env.example` の説明を参照。

| 変数 | 必須度 | 未設定のとき |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`（または `..._ANON_KEY`） | 必須 | サイトが動かない |
| `SUPABASE_SERVICE_ROLE_KEY` | 必須 | 管理画面・サーバーAPI の多くが動かない |
| `OPENAI_API_KEY` | 必須 | AI相談・埋め込み同期が動かない |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | 必須 | `/api/health` が 503。レート制限が in-memory になり実効性を失う |
| `CRON_SECRET` | 必須 | `sync-embeddings` などの cron が常に拒否される |
| `NEXT_PUBLIC_SITE_URL` | 設定するなら正しい値 | **値が入っていて不正（http/https 以外・解釈不能）だと本番ビルドが失敗する**。未設定なら `https://nicchyo.jp` |
| `ANTHROPIC_API_KEY` | 任意 | 週次セキュリティレポートが生成されない |
| `RESEND_API_KEY` / `NOTIFICATION_FROM_EMAIL` / `ADMIN_NOTIFICATION_EMAIL` | 任意 | メール送信をスキップ（ログのみ） |
| `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | 任意 | LINE webhook は何も処理しない |
| `DISCORD_WEBHOOK_URL` / `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | 任意 | 通知・計測・スパム対策が無効 |
| `ADMIN_USER_EMAIL` / `ADMIN_USER_PASSWORD` | **本番には設定しない** | 開発専用（`scripts/create-admin-user.mjs`） |

- 古い `COUPON_QR_SECRET` / `NEXT_PUBLIC_DEV_MARKET_DAY` は不要になったので、本番にあっても害はないが消してよい。
- `vercel.json` の `regions: ["icn1"]` は関数リージョンの固定。Supabase のリージョンと近いことを確認する。

**GitHub Environment**（Settings → Environments）:

- `production` に **Required reviewers が設定されている**こと。Environment が無い・保護ルールが空だと、ワークフローが Environment を自動作成して**承認なしで本番に適用される**。
- `production` と `production-dry-run` の両方に、Secrets（`SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD`）と Variable（`SUPABASE_PROJECT_ID`）があり、プロジェクトIDが**本番**のものであること（§9）。

**cron**: `weekly-security-report` は `CRON_SECRET` 認証付きの API があるが、`vercel.json` の `crons` には `sync-embeddings` しか登録されていない。
週次実行を想定しているなら、登録の要否をリリース前に決める（意図が不明なら登録しない現状のまま出す）。

### 4.4 リリース当日の手順

1. **トリガー条件の確認** — §3 の (a) または (b) を満たしているか。曜日が金曜か（土日はやらない）。
2. **レビュー中PRの整理** — マージ予定のPRは先に `develop` へ入れる。間に合わないPRは次回リリースに回す。
3. **`develop` の CI 通過を確認** — lint / tsc / test / build（`.github/workflows/ci.yml`）。§4.1 の取り込みが `develop` に入っていること。
4. **本番DBのバックアップを取り、時刻を記録する（必須）** — Supabase ダッシュボード → Database → Backups で、
   PITR が有効ならその**復元可能な時刻を控える**。PITR が無ければ手動バックアップ（または `pg_dump`）を取る。
   特に `coupon_*` / `kotodutes` / `web_page_analytics` / `ai_consult_logs` / `vendors.owner_name`（§4.2）。
   **リリースPRに「バックアップ取得時刻: YYYY-MM-DD HH:MM JST」を書く**。書けていなければ承認しない。
5. **`app/about/versions.ts` を更新** — `versionHistory` の先頭に新エントリを追加。来訪者から見て何が変わったかを3〜5件で書く（開発の詳細はコミットに残るので書かない）。
   元になる `docs/changelog-unreleased/` は **`npm run changelog:pack` の前にスクリプトを読む**こと（§6）。引数なしで実行すると集約したフラグメントファイルを**実際に削除する**。
   `--help` で使い方、`--dry-run` で集約される行の確認ができる（どちらもファイルを変更しない）。
6. **リリースPRを作成** — `develop` → `main`。タイトルは `verX.Y: <概要> / Develop (#PR番号)`。本文に §4.2 の破壊的マイグレーション一覧とバックアップ時刻を書く。
7. **Preview で通し確認** — リリースPRの Preview URL で以下を実機確認する。ビルドが通ることは動作の保証にならない。
   - マップ（`/map`）: 店舗マーカー表示・ズーム・道の描画・店舗詳細バナー。既定の描画が Leaflet → MapLibre（WebGL）に変わっているので、iOS Safari / Android Chrome で確認し、`public/maplibre/maplibre-gl-worker.mjs` が 200 で配信されること
   - 検索（`/search`）
   - AI相談（`/consult`）: 「にちよさん」が応答するか
   - 近況（story）
   - 出店者ページ（`/my-shop`）
   - 管理画面（`/admin`）: 主要画面が開くか
8. **マージする時間帯を決める** — 来訪者が少ない時間（金曜の日中〜夕方、日曜市開催時間外）。**日曜市の開催時間・前日は避ける**。
9. **`main` へマージ** — Vercel が Production へ自動デプロイし、同時に `Migrations Deploy` の **dry-run ジョブ**（本番）が走る（承認不要・本番には書き込まない）。
   この時点では**まだ本番DBは変わらない**。承認待ち（`apply` ジョブ）で止まっている。
10. **dry-run の Step Summary を読む** — Actions の実行ページで次を確認する。
    - 未適用の件数とファイル一覧が §4.2 で把握した内容と一致しているか
    - 「破壊的・不可逆になりうる文」の一覧に、想定外のものが無いか
    - `Validate migration sync status` が通っているか（Remote にだけある履歴が無いか）
11. **新アプリが Ready になるのを待ち、メンテナンスモードを有効にする** — Vercel の Production デプロイが Ready になってから行う。
    **v1.3 の本番コードにはメンテナンスモードが無い**ため、デプロイ前に有効にしても来訪者は止まらない。
    - 管理画面 `/admin/settings` で「メンテナンスモード」をオンにする。
      管理画面が新アプリ×旧DBで開けない場合は、SQL Editor で直接立てる:
      `update public.system_settings set value = jsonb_set(value, '{maintenanceMode}', 'true') where key = 'public';`
    - 来訪者のページが `/maintenance` に切り替わることを確認する（`/admin` と `/api` は止まらない）。proxy の設定キャッシュは約60秒。
12. **`production` Environment の承認を押す（`apply` ジョブ）** — ここで初めて本番DBが変わる。
    承認前に最後に確認: バックアップ時刻の記録済み／メンテナンス中／dry-run の差分を読んだ。
    `apply` は適用の直前にもう一度 dry-run を取り、**承認した差分と未適用の集合が変わっていれば何もせず失敗する**（その場合は dry-run からやり直す）。
13. **適用後の回帰チェック** — Supabase の SQL Editor で `supabase/checks/*.sql` を実行する（どちらも読み取りのみ。エラーが出たら異常）。
    `Migration status (after)` で Local と Remote の履歴が揃っていることも確認する。
14. **メンテナンスモードを解除する** — 管理画面、または
    `update public.system_settings set value = jsonb_set(value, '{maintenanceMode}', 'false') where key = 'public';`
15. **本番確認** — `nicchyo.vercel.app` で手順7と同じ項目を再確認する。
16. **タグを打つ** — `git tag v1.x && git push origin v1.x`。
17. **`main` を `develop` に取り込む** — 4.1 で解消済みなので、マージ方式の差でズレが残らないよう `main` → `develop` を戻しマージして確認する。

> Vercel のデプロイは `main` への push で自動的に走り止められない。
> 「アプリが先に新しくなり、DBが後から新しくなる」順序になるため、その間（手順9〜12）は新アプリ × 旧DB の状態になる。
> 新アプリは旧スキーマ（`shop_members` などが無い状態）では正しく動かないので、**この間は必ずメンテナンスモード**にして来訪者を `/maintenance` に逃がす。
> 手順9の直後は数分間、新アプリ × 旧DBのまま来訪者に見えるので、マージは来訪者の少ない時間に行う。

### 4.5 ロールバック

| 対象 | できること |
|---|---|
| アプリ（コード） | Vercel の **Instant Rollback**（Deployments → 過去の Production デプロイ → Promote / Rollback）で戻せる。**戻るのはアプリだけ。DBは変わらない** |
| DB | **自動では戻せない**。戻すには手順4で取った**バックアップ（PITR）からの復元**のみ。復元すると、バックアップ以降に来訪者・出店者が書いたデータ（お気に入り・近況・問い合わせ等）も失われる |
| 「DB適用後にアプリだけ戻す」 | **旧コード（v1.3）は削除済みのテーブルを参照して 500 になる**。Instant Rollback は DB 適用前の失敗にだけ有効 |

判断の目安:

- **`apply` の前に問題が見つかった** → 承認せず（Reject）、Vercel を Instant Rollback。DBは未変更。
- **`apply` が途中で失敗した** → 各マイグレーションは別トランザクションなので**途中までは適用済み**。`Migration status (after)` と Actions のログで、どこまで進んだかを確認する。
  修正マイグレーションを前方に追加して再実行するのが基本（既存ファイルは編集しない）。復元は最終手段。メンテナンスモードは解除しない。
- **`apply` は成功したが不具合が出た** → 小さければ hotfix（§5）で前に進める。致命的なら、メンテナンスモードのまま PITR 復元を検討する（データ消失の範囲を運営と合意してから）。

### 4.6 マージ当日チェックリスト

リリースPRの本文にコピーして使う。

**前日まで**

- [ ] `main` → `develop` の取り込み（§4.1）が `develop` に入っている（`git diff origin/develop` が空、ビルドが通る）
- [ ] §4.2 の破壊的マイグレーション一覧を確認し、データを消してよいと運営が合意している
- [ ] 本番データの事前確認 SQL（§4.2）を実行し、結果を記録した
- [ ] `npx supabase migration list --linked` で本番と履歴が揃っている（Remote だけにある履歴・手で適用済みの履歴を解消済み）
- [ ] 今回のリリースに入るマイグレーションが、開発（`develop` の `Migrations Deploy`）で dry-run と apply まで通っている
- [ ] Vercel Production の環境変数（§4.3）を確認した。`NEXT_PUBLIC_SITE_URL` が不正でない
- [ ] GitHub Environment `production` に Required reviewers がある。`production` と `production-dry-run` に Secrets と Variable（`SUPABASE_PROJECT_ID`）がある
- [ ] `app/about/versions.ts` に新バージョンを追記した。`docs/changelog-unreleased/` の `#TBD` が残っていない
- [ ] Preview で通し確認（マップ・検索・AI相談・近況・出店者・管理画面）を済ませた
- [ ] 金曜（日曜市の前日・当日ではない）で、マージする時間帯が決まっている

**マージ直前**

- [ ] 本番DBのバックアップ/PITR を取得し、**取得時刻をリリースPRに記録した**
- [ ] 承認者（Required reviewers）が稼働できる時間帯である

**マージ〜適用**

- [ ] `main` にマージした
- [ ] Vercel の Production デプロイが Ready になった
- [ ] `Migrations Deploy` の dry-run の Step Summary を読み、件数・破壊的な文が想定どおり
- [ ] メンテナンスモードをオンにし、`/maintenance` が表示されることを確認した
- [ ] `production` Environment を承認した
- [ ] `Migration status (after)` で履歴が揃った
- [ ] `supabase/checks/*.sql` を本番で実行し、エラーが無かった

**適用後**

- [ ] メンテナンスモードをオフにした
- [ ] 本番確認（`/map`・`/search`・`/consult`・`/my-shop`・`/admin`）
- [ ] Discord 通知のリンクなど、旧URLの 404 が無いか確認した（`/reports/<日付>` は develop で移動済み）
- [ ] `git tag v1.x` を打って push した
- [ ] `main` → `develop` を戻しマージした
- [ ] バックアップは次のリリースまで消さない（保持期限を確認した）

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

`docs/changelog-unreleased/` に、**develop へマージするPRごとに個別ファイル（例: `644.md` または `ブランチ名.md`）** を1つ追加する（1行のみ記述）。

```markdown
- 日曜市カレンダーに出店予定と旬を表示するようにした (#444)
```

- 書くのは**来訪者から見て何が変わったか**の一言。実装の詳細はコミットに残るので書かない。
- 来訪者に見えない変更（依存更新・テスト追加・リファクタ・ドキュメント）は書かなくてよい。
- PRごとに個別ファイルを作成することで、複数PR間のマージコンフリクトを完全に防ぐ。
- リリース時は `npm run changelog:pack` でこれらを `docs/CHANGELOG-unreleased.md` へ一括集約する。
  **引数なしで実行すると集約したフラグメントファイルを削除する**ので、実行前に `scripts/pack-changelog.mjs` を読み、
  先に `node scripts/pack-changelog.mjs --dry-run`（ファイルを変更しない）で内容を確認する。`--help` で使い方が出る。

この記録には2つの役目がある。

1. **リリースノートが書ける** — リリース時にこのファイルを `app/about/versions.ts` へ転記して空にする。
   778コミットを後から遡って要約する作業（今まさに発生している負債）が二度と起きない。
2. **溜まり具合が見える** — 行数が増えていくこと自体がリリース時期の圧力になる。

`.github/workflows/release-reminder.yml` が毎週金曜9時（JST）にこのファイルの行数と
前回リリースからの経過日数を見て、§3 の条件を満たしていればリリース確認の Issue を立てる。
このワークフローは `v1.*` タグが存在するときだけ動く（初回リリース後に自動で有効になる）。

---

## 7. 初回リリースへの移行手順

**着手条件**: レビュー中のPRがマージまたはクローズされていること。レビュー往復中の変更を含んだまま数ヶ月分を本番へ出さない。
（2026-08 時点では #479 マップ編集v3 1/3、#492 map-spec更新、#408 README が対象だった。着手時に取り直す。）

**手順の本体は §4**。このセクションは「初回だけ必要な作業」と「一括か分割かの判断」だけを扱う。

### 現状（2026-10-07 のレビュー時点）

- `origin/main` は v1.3（`33c2b56`、2026-05-19）のまま。`develop` は **1903 コミット / 1222 ファイル**先行している。
- `main` と `develop` は履歴が分岐しているため、**直接マージすると 57 件のコンフリクト**になる（§4.1 で先に解消する）。
- マイグレーションは `develop` が 125 本、うち `main` に無いものが 74 本（最新は `20261004160000`）。DROP を含む不可逆なものがある（§4.2）。
- 以前この節に書いていた「`git merge <境界SHA>` を順に行うだけで済み、コンフリクトは起きても1回」という前提は**成り立たない**。
  境界コミットを `main` に直接マージしても、squash 由来の分岐のため同じコンフリクトが出る。

### 判断欄: 一括（v1.4 として1回）か、v1.4 / v1.5 の分割か

どちらにするかを**リリース担当が決め、リリースPRに理由を書く**。

| | 一括 | 分割（v1.4 → v1.5） |
|---|---|---|
| コンフリクト解消 | §4.1 を1回 | 境界ごとに同じ解消が必要（境界側にも develop と同じ解消方針を適用する） |
| DB適用 | 1回のメンテナンス窓で全件 | 2回に分かれる（各回に §4.2〜4.5 を実施）。1回あたりの変更量は減る |
| 本番に出る変更の量 | 約5ヶ月分が一度に変わる | 段階的に確認できる |
| 戻しやすさ | バックアップは1つ | リリースごとにバックアップが必要 |
| 注意 | 来訪者向けの変化が大きい（`versions.ts` の要約が長くなる） | 境界を6月末にしてはいけない（図鑑が一度現れてすぐ消える）。2026-08 時点の案は下表 |

- [ ] 一括にする（理由: ）
- [ ] 分割にする（境界コミット: ／理由: ）

**分割する場合の境界案（2026-08-13 時点の見込み。着手時に `git log` で取り直すこと）**

| | 範囲 | 境界コミット | 主な内容 |
|---|---|---|---|
| **v1.4** | `main` 〜 2026-07-25 | `61ecc1f`（PR #399） | セキュリティ・RLS強化、クーポン機能とことづてページの削除、マップUX・ズーム改善、AI相談の品質改善、近況機能、おでかけサポート（近隣探索）、管理者機能（RBAC・報告・問い合わせ・設定） |
| **v1.5** | 2026-07-26 〜 現在 | `develop` HEAD | 日曜市カレンダー、おでかけサポート拡充、管理者ロール統合・一斉メール、RLS追加強化、バッジ/レシピ/ことづて/出店状況投票の削除、about ページ刷新、マップ編集v3 |

- 7/25 と 8/06 の間に11日の活動空白があり、開発の区切りと一致する。
- **6月末で3分割してはいけない。** 図鑑機能が6月に追加され7月に削除されているため、6月末で切ると本番に図鑑が一度現れてすぐ消える。

### 初回だけ必要な作業

1. **Vercel の Production Branch を `main` に明示設定する**（Vercel ダッシュボード → nicchyo → Settings → Git）。
   これは手動作業。設定だけでは再デプロイは走らないので、この時点で本番は変わらない。
2. **本番 Supabase のマイグレーション適用状況を確認する。** 本番DBに適用済みかを確認する（関連: #425）。
   コードだけ進んでテーブルが無い状態を作らない。手順は §9「初回セットアップ」。ここで履歴を揃えておけば、以降のリリースでは自動適用に任せられる。
3. **§4.1〜§4.6 に従ってリリースする**（分割する場合は各リリースで繰り返す。2本目は1本目の本番確認が済んでから）。
4. リリース後、`npm run changelog:pack` で未リリースフラグメントを集約する。**実行前に `scripts/pack-changelog.mjs` を読む**こと。
   引数なしだとフラグメントを削除する。先に `--dry-run` で内容を確認し、集約後に `docs/CHANGELOG-unreleased.md` の一覧をリリースノート（`app/about/versions.ts`）へ転記して空にする。
5. 以降は §3 のトリガーと §6 の記録に従って運用する。

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
PR（全ブランチ対象）      Migrations Check   : まっさらなローカルPostgresに全マイグレーションを頭から適用。
                                            開発・本番には触らない。落ちたらマージしない。
develop にマージ          Migrations Deploy  : 開発用 Supabase が対象。承認なしで dry-run → apply まで自動。
main にマージ（=リリース） Migrations Deploy  : 本番 Supabase が対象。2ジョブ構成。
                            ① dry-run … 承認なし。未適用の一覧・破壊的な文を Step Summary に出す。本番は変えない。
                            ② apply   … Environment `production` の承認後に、未適用分だけを順に適用。
                                        承認した dry-run と未適用の集合が変わっていたら適用しない。
```

- 適用先はブランチで決まる。**`develop` は開発用、`main` は本番用**のプロジェクトにだけ向かう。
  手動実行（Run workflow）も、選んだブランチの対象にしか向かない（`main` / `develop` 以外では何も走らない）。
- 承認の**前**に dry-run の差分を読める（承認待ちのジョブは `apply` で、dry-run は先に終わっている）。
- dry-run と apply の Step Summary の先頭に「対象（開発/本番）」と「プロジェクトID」が出る。
  承認する前に、IDが想定のプロジェクトか（本番は `yrypxygzqtkdwvasczsq`）を必ず見る。
- 取り違えはワークフローでも止める。`migrations-deploy.yml` の `PRODUCTION_PROJECT_ID`（本番の ID）と比べ、
  `develop` の Variable が本番を指していたら、`main` の Variable が本番以外を指していたら、DB に触る前に失敗する。
  本番の ID を変えるときは、このファイルとワークフローの両方を直す。

| 名前 | Reference ID | 役割 |
|---|---|---|
| 本番 | `yrypxygzqtkdwvasczsq` | `main` の適用先（Environment `production` / `production-dry-run`） |
| 開発（`nicchyo-development`） | `dbaufykimgzfgoeyyxwz` | `develop` の適用先（Environment `development`） |

> **切り替えが済むまでの注意（2026-10-08 時点）**: Vercel の Production はまだ `dbaufykimgzfgoeyyxwz`（開発）を見ている。
> この間は `develop` への push が、本番アプリの使う DB に承認なしで適用される。Vercel の Production / Preview の環境変数を
> 本番プロジェクトへ切り替えるまで、Environment `development` にも Required reviewers を付けておくこと。切り替えたらこの注意を消す。
- Supabase CLI は `migrations-deploy.yml` / `migrations-check.yml` の両方で**バージョン固定**（`supabase/setup-cli` もコミット SHA 固定）。
  上げるときは両方を同時に変え、dry-run で挙動を確かめる。
- 適用後の `supabase/checks/*.sql` は本番に自動では流さない（Actions から本番DBへ psql を張っていない）。SQL Editor で手動実行する（§4.4 手順13）。

- 適用済みかどうかは Supabase 側の `supabase_migrations.schema_migrations` で管理される。
  同じファイルが二度適用されることはない。
- `develop` やフィーチャーブランチへのマージでは本番に適用しない。`develop` は開発用プロジェクトにだけ適用される。
  未リリースのコードが前提のスキーマ変更を、先に本番へ入れないようにしている。
- `migrations-deploy.yml` は事前検証でリモート履歴乖離（手動SQLや別ブランチ由来）を検知し、復旧用 repair コマンドを Step Summary に提示する。
- ロールバックは自動化しない。失敗時は Actions のログを見て、修正マイグレーションを追加して対処する。
  DB を巻き戻せるのは**バックアップ（PITR）からの復元だけ**（Vercel の Instant Rollback はアプリのみ。§4.5）。
- 適用の前に必ずバックアップ/PITR の時刻を記録する（§4.4 手順4）。ワークフロー側ではバックアップの有無を検査できないので、
  承認者が確認する。

### マイグレーションを書くときのルール

アプリのデプロイ（Vercel）とDBの適用（Actions）は `main` への push で**並走**する。DB の適用は承認を待つので、
実際の順序は「承認を押した時点」で人が決める。ただし、どちらが先でも旧コード or 新コードのどちらかは壊れうるため、
マイグレーションは**後方互換**（旧コードでも動く）にするのが基本。

- 追加系（`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`）を基本にする
- カラム削除・リネーム・NOT NULL 追加は、先にコード側の参照を外してリリースし、次のリリースで消す（expand → contract）
- 破壊的変更を1リリースで済ませる場合は、リリースPRに明記し、§4.2 の一覧に載せたうえで、
  **バックアップ取得 → Vercel デプロイが Ready → メンテナンスモード → 承認** の順で行う（§4.4）。
  承認を先に押す運用はしない（旧アプリが削除済みのテーブルを参照して 500 になる）。

### 初回セットアップ（1回だけ・要 Supabase 管理者権限）

1. **GitHub Environment を3つ作る** — Settings → Environments → New environment。

   | Environment | 使うブランチ | Required reviewers | Deployment branches |
   |---|---|---|---|
   | `production` | `main`（apply） | **必須**（承認者はリリース担当者） | `main` のみ |
   | `production-dry-run` | `main`（dry-run） | 付けない | `main` のみ |
   | `development` | `develop`（dry-run と apply の両方） | 付けない | `develop` のみ |

   **Environment が無い／保護ルールが空だと、ワークフローが自動作成して承認なしで適用する**ので、本番は必ず先に作る。
   Environment の Secrets / Variables はその Environment を指定したジョブにしか渡らないため、承認なしで走る dry-run ジョブには専用の Environment が要る。
   開発は承認なしで進める方針なので、dry-run と apply で同じ `development` を使う。
2. **Environment の Secrets と Variables を登録する**（Repository 側ではなく Environment 側に入れる）。
   各 Environment に、**そのプロジェクトの値**を入れる。本番用の2つ（`production` / `production-dry-run`）は同じ本番の値、`development` は開発用の値。

   | 種類 | 名前 | 内容 |
   |---|---|---|
   | Secret | `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens で発行。環境ごとに別のトークンにすると、漏れたときの影響を絞れる |
   | Secret | `SUPABASE_DB_PASSWORD` | そのプロジェクトの DB パスワード（Settings → Database） |
   | **Variable** | `SUPABASE_PROJECT_ID` | そのプロジェクトの Reference ID（20文字。Settings → General） |

   プロジェクトIDは秘密ではないので **Variables** に入れる。Secrets に入れると GitHub が同じ文字列を `***` に伏せてしまい、
   Summary やログで接続先を確認できない。ワークフローは、形式（小文字20文字）が違う・未設定のときは止まる。
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
4. **dry run で確認する** — Actions → `Migrations Deploy` → Run workflow（Use workflow from で `main` を選ぶ。`dry_run` = true）。
   `dry-run` ジョブの Step Summary（未適用の一覧・破壊的な文・`Dry run` の出力）が期待どおりか見る。
   `dry_run` = true のときは `apply` ジョブは走らない。
5. 問題なければ以降は `main` マージごとに dry-run が自動で起動し、`apply` は承認待ちになる。
   **Required reviewers は外さない**。DROP を含むリリースで人の確認を挟めなくなる（§4.2）。

### うまくいかないとき

**`Migrations Deploy` が一瞬で失敗する / `main` `develop` 以外のブランチでも走る**

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

**`migration list` の Remote 側にだけある行は消す（放置すると `db push` が止まる）**

リポジトリに対応する `.sql` が無いバージョンが Remote の履歴に残っていると、
`supabase db push` は**その時点で停止する**。適用対象が無くても関係なく落ちる。

```
Remote migration versions not found in local migrations directory.

Make sure your local git repo is up-to-date. If the error persists, try repairing
the migration history table:
supabase migration repair --status reverted <version> ...
```

「Local に無いものは無視して進む」わけではないので、**Remote 側の余りは
必ず解消すること**。`schema_migrations` に status 列は無く、`--status reverted`
は該当行の削除と同じ意味になる。

消す前に、その行の `statements` 列を必ず確認する。ここには**本番へ実際に流れた
SQL が入っている**。リポジトリのファイルと1対1で対応しないもの（複数のマイグレーションを
1回にまとめて適用した場合など）は、消すと再現できなくなる。

```sql
select version, name, array_to_string(statements, E'\n') as sql
from supabase_migrations.schema_migrations
where version in (...);
```

内容がリポジトリから復元できることを確かめてから消す。復元できないものがあれば、
先に同じ内容の `.sql` をリポジトリへ追加し、**ファイル名のタイムスタンプを
Remote の version に合わせる**（そうすれば消さずに一致させられる）。

2026-09-06 の実例: `Migrations Deploy` が動いていなかったことが判明し、未適用だった
17本を Supabase の管理API経由で手当てした。その際に自動採番された10件
（`20260906122700` 〜 `20260906123229`）が Remote 側にだけ残り、`db push` が
止まっていた。10件とも内容がリポジトリの既存ファイルから復元できることを確認して削除し、
`Remote database is up to date.` になった。経緯は #573 を参照。

### 補足

- `migrations-check.yml` は `supabase/migrations/**` を触ったPRでしか走らない。ブランチ保護の
  必須チェックには入れない（走らないPRで pending のままになるため）。
- リポジトリに `supabase/config.toml` は置いていない。CI 内で `supabase init` して生成している。
  ローカルで `npx supabase start` するときは各自の手元の config.toml が使われる。
