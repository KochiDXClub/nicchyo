# ローカル開発環境セットアップ

マップにお店が表示されない場合、ローカルDBにデータが入っていない可能性があります。

## なぜお店が表示されないのか

マップデータは Supabase（PostgreSQL）から取得しています。ローカル開発では Docker 上で Supabase を起動しますが、**スキーマ（テーブル構造）は自動で作られるものの、データは空の状態**です。

```
本番Supabase（クラウド）  ←  お店データが入っている
         ↕ 手動でコピーが必要
ローカルSupabase（Docker） ←  空の状態で起動する
```

## 初回セットアップ手順

### 前提
- Docker Desktop が起動していること
- `.env.local.production` をチームメンバーから入手済みであること（後述）

```bash
# 1. ローカルSupabase起動
npx supabase start

# 2. 本番データをローカルに流し込む
npm run db:seed

# 3. 開発サーバー起動
npm run dev
```

これだけです。

## `.env.local.production` の入手方法

`npm run db:seed` は本番 Supabase への接続に `.env.local.production` を使います。  
このファイルはセキュリティ上 `.gitignore` されているため、**チームメンバーに共有を依頼してください**。

入手したファイルをプロジェクトルートに置いてください：

```
nicchyo-platform/
├── .env.local              ← 自分で作る（cp .env.example .env.local）
├── .env.local.production   ← チームメンバーから入手する
└── ...
```

## 再起動後

PC 再起動後など、Docker を再起動した場合：

```bash
npx supabase start   # DBデータはDockerボリュームに保持される
npm run dev
```

データが消えた場合（`npx supabase db reset` を実行した後など）はステップ2を再実行してください。

## ローカルデータを最新に更新したいとき

本番でお店情報が更新された場合など、ローカルを最新に同期したいときは：

```bash
npm run db:seed
```

開発中に「なんか表示がおかしい」と思ったらまずこれを試してください。

## トラブルシューティング

### `npx supabase start` でエラーになる
→ Docker Desktop が起動しているか確認してください。

### `npm run db:seed` でエラーになる（環境変数）
→ `.env.local.production` がプロジェクトルートにあるか確認してください。

### `npm run db:seed` でエラーになる（Dockerコンテナ）
→ `npx supabase start` が完了しているか確認してください。

### それでもお店が表示されない
ローカルDBにデータが入っているか確認：
```bash
# vendors テーブルに300件あればOK
curl -s "http://127.0.0.1:54321/rest/v1/vendors?limit=1" \
  -H "apikey: $(grep PUBLISHABLE_DEFAULT_KEY .env.local | cut -d= -f2)"
```

`[]` が返ってきたらデータが空なので `npm run db:seed` を再実行してください。
