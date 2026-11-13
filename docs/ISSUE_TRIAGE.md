# Issue の整理ルール

Issue を「誰が・いつ・やるのか」が分かる状態に保つための最小限のルール。

## 1. 起票するとき

- **種類のラベル**を 1 つ以上付ける: `bug` / `enhancement` / `tech-debt` / `security` / `performance` / `ui/ux` / `documentation`
- **優先度**を付ける: `priority: high` / `priority: medium` / `priority: low`
- すぐ着手しない構想・アイデアは `idea` を付ける。もっと話し合いたいものは Discussions の「アイディア」でもよい

## 2. 担当者

- `priority: medium` 以上の `bug` には担当者を付ける
- 担当できる人がいないときは `help wanted` を付けて、そのことが見て分かるようにする

## 3. 動きのない Issue

- 90 日間更新がない Issue は、コメントで「まだ必要か」を確認する
- 2 週間返事がなければ **not planned** でクローズする。必要になれば再オープンすればよい
- `epic` / `mini-project` / `idea` は対象外

## 4. PR との紐づけ

- PR で完全に直すときは、本文に `Closes #番号` と書く（マージ時に自動でクローズされる）
- 一部だけ直すときは `Refs #番号` と書き、Issue に残りの作業をコメントする
- 複数の Issue を閉じるときは、1 つずつキーワードを付ける（`Closes #1, Closes #2`）。`Closes #1, #2` と書くと `#2` は閉じない
- 「範囲外」として本文で触れるだけの Issue は、マージしても閉じない

## 5. 週に 1 回の確認（15 分）

次の 3 つの一覧を開き、ラベル・優先度・担当者を付ける。

| 見るもの | 検索条件 |
|---|---|
| ラベルがない | `is:issue is:open no:label` |
| 担当者がいない bug | `is:issue is:open label:bug no:assignee -label:"priority: low"` |
| 90 日動きがない | `is:issue is:open updated:<YYYY-MM-DD -label:epic -label:mini-project -label:idea`（日付は 90 日前） |
