# 出店者アカウントの仕組み（店舗とメンバー）

出店者のアカウント構造は、「1 ユーザー＝1 店舗」から、**「店舗」と「ログインアカウント」を分け、複数のアカウント（代表者 1 人＋メンバー）を 1 店舗に紐づける**形に変わった。
要件は [requirements/vendor.md](./requirements/vendor.md)（S-10・S-12）と [requirements/admin.md](./requirements/admin.md)（A-17）。

---

## 1. データの形

```
auth.users（ログインアカウント。Google）
   │  user_id（1 アカウントが入れる店舗は 1 つ）
shop_members ── vendor_id ──▶ vendors（店舗。id は店舗のキー。アカウントなしでも存在できる）
   role: owner | member
   permissions: text[]            vendors に紐づく: vendor_contents / products / store_knowledge / …
shop_invites       招待リンク（ハッシュのみ。7 日・1〜5 人）
shop_claim_tokens  QR コード（ハッシュのみ。1 店舗に有効なものは 1 つ）
vendor_activity_logs  操作ログ（追記専用）
```

- **`vendors.id` は店舗のキー**（アカウントの ID ではない）。コードで「自分の店舗の ID」が要るときは、`user.id` を使わず、`user.vendorId`（画面）／`requireVendorContext()` の `vendorId`（API）を使う。
- **権限キー**（`lib/vendor/shopPermissions.ts` が単一の情報源。DB の check 制約と対応）: `store_edit` 店舗情報・商品・写真・出店日 / `post` 近況 / `ai_notes` にちよさんの覚えごと / `inquiries` 運営・市役所との連絡 / `analytics` お店の分析 / `audit_view` 操作ログ / `members_manage` メンバーの管理（副代表）。**代表者は常に全権限**。
- 判定は 2 重に守る: **DB**（RLS。`has_shop_permission(店舗, 権限)`）と **API**（`requireVendorContext({ permission })`）。
- Storage（`vendor-images`）は、ファイル名の形で権限を決める（`vendor_image_permission()`）: `<店舗ID>/inquiries/…` → `inquiries`、`store-main.*`・`store-thumb.*`・`product-*` → `store_edit`、それ以外（近況の写真）→ `post`。

## 2. マイグレーションの適用

`supabase/migrations/` の次の 5 本を、**日付順に**適用する（`20261003100000` から）。途中の 1 本だけを適用した状態で運用しない（API・画面が前提にしているため）。

| ファイル | 内容 |
|---|---|
| `20261003100000_create_shop_members.sql` | `shop_members`・判定関数・`vendors` と `auth.users` の外部キーを外す・既存の出店者を代表者へ移す・ブラウザからの店舗作成を閉じる |
| `20261003100100_rls_use_shop_members.sql` | 出店者向けの RLS（約 20 テーブル＋Storage）を権限判定へ |
| `20261003100200_create_vendor_activity_logs.sql` | 操作ログ |
| `20261003110000_create_shop_invites_and_transfer.sql` | 招待リンク・招待を受ける関数・代表者の引き継ぎ |
| `20261003120000_create_shop_claim_tokens.sql` | QR・発行/紐づけ/解除の関数 |
| `20261003130000_begin_owner_withdrawal.sql` | 代表者の退会（確認・招待の取り消し・氏名の削除を 1 トランザクションで） |
| `20261004100000_create_user_avatars_bucket.sql` | アカウントのプロフィール写真用バケット `user-avatars`（本人のフォルダにだけ書ける） |

- CI（Migrations Check）が、全マイグレーションをまっさらな DB に流し、さらに `supabase/checks/no_legacy_vendor_policies.sql` で「`auth.uid()` だけで店舗の行を絞る旧い RLS が残っていない」ことを確かめる。**店舗に紐づく新しいテーブルを足すときは、RLS を `has_shop_permission` で書く**（旧い書き方だと CI が落ちる）。
- **既存の出店者**（開発・検証用 DB）は、`vendors.id` と同じ ID のログインアカウントが、そのまま代表者になる。**本番は店舗データを先に入れてアカウントなしで始める**ので、移行で入るメンバーは 0 件。
- 旧来のスクリプト（`scripts/create-vendors*.js`。`vendors.id` = ユーザー ID で作る）は、店舗行の作成時に同じ ID のアカウントがあれば代表者を自動で付ける（トリガ）。本番の店舗は、アカウントを作らずに店舗行だけを `service_role`（SQL か `scripts/`）で作る。

## 3. Supabase の設定（リポジトリの外）

> **デプロイ前チェック（必ず）**
> 1. 表のマイグレーションを、日付の順にすべて適用する。
> 2. 下の Redirect URLs に `/join/**` と `/claim/**` を足す（なければ、ログイン後に Site URL へ戻され、参加が続かない）。
> 3. **`/claim/*` と `/join/*` の URL は秘密**（QR は期限なし。最初に使った人が代表者になる）。解析（`web_page_analytics`）と GA には送らない作りになっている（`lib/analytics/secretPaths.ts`）。この除外が入ったコードをデプロイしてから QR・招待を発行すること。GA の「拡張計測」の履歴変更イベントは GA 側で切っておく。

- **Authentication → URL Configuration → Redirect URLs** に、招待リンクとQRの参加ページが戻れるよう、次を許可する（Google ログイン後に、いま開いているページへ戻すため）:
  - `https://<本番ドメイン>/join/**`
  - `https://<本番ドメイン>/claim/**`
  - プレビュー環境でも試すなら、そのドメインも。許可がないと、ログイン後に Site URL へ戻され、参加の続きができない。
- Google プロバイダが有効で、メール/パスワードのログインを使わない運用でも、この仕組みは動く（参加は Google アカウントのログインだけで完結する）。

## 4. 運用

### 店舗の箱を先に作る（運営）
運営が、店名・カテゴリなどを持った店舗を**アカウントなし**で先に用意し、出店者があとから QR で紐づく。
```bash
node scripts/create-shop-boxes.mjs --dry-run   # 何が作られるかだけを見る（DB には触らない）
node scripts/create-shop-boxes.mjs             # 作る（向き先の URL を確かめてから）
```
- 入力は `data/shopsmanage/shops_rows.csv`（`id`・`name`・`category` など）。CSV の `id` がそのまま店舗の ID になるので、何度実行しても同じ店舗になる。**すでにある店舗は上書きしない**（出店者が編集した内容を壊さない）。
- 店舗の**位置**は、このスクリプトの対象外（マップ編集・配置の画面で登録する）。
- 旧来の `scripts/create-vendors-from-shops.js`（店ごとにメール・パスワードのアカウントも作る方式）は、新しい運用では使わない。

**アカウントのない店舗でも動くもの**（確認済み）: 来訪者の地図・検索・店舗ページへの表示／商品・近況・出店日などの登録（管理側）／マップの配置／管理画面の店舗一覧（代表者の欄は「未紐づけ」）／一括の削除（店舗の行を直接消す）／一括の停止・復活（対象のアカウントがない店舗は、エラーにせず飛ばす）。店舗に紐づく全テーブルは `vendors` を指していて、`auth.users` を店舗の ID で指すものはない（`shop_attendance_vendor` は未使用）。

### 出店者へ QR を配る（運営）
1. 店舗の箱を先に作る（上）。
2. 管理画面 `/admin/shop-claims` で、店舗を選んで **QR を発行**（最大 300 店を一括）→ 印刷用のシートを印刷する。**QR の中身は、この画面でしか見られない**（閉じると出せない。出し直しはできる）。
3. 出店者が QR を読み、Google でログインすると、**最初にスキャンした人が代表者**になる。代表者がいる店舗には発行も紐づけもできない。
4. QR をなくした・乗っ取られた・担当が変わった → **「紐づけを解除」**（メンバー全員が外れ、招待リンクと QR が無効になる。店舗の掲載情報は残る）→ QR を出し直す。

### 家族・スタッフを増やす（出店者）
代表者（と、メンバー管理の権限がある副代表）が、アカウント設定の「家族やスタッフを招待する」で、人数（1〜5 人）と権限を決めて招待リンクを作り、LINE などで送る。リンクは 7 日間使える。

### 代表者を変える・退会する
- 代表者の変更は、アカウント設定の「代表者を引き継ぐ」（もとの代表者は全権限の副代表として残る）。
- 退会は、アカウント設定の一番下。消えるもの・残るものは画面に出る（要件 S-10b）。代表者は、ほかにメンバーがいる間は退会できない。

### 操作ログ
- 出店者: アカウント設定の「操作ログ」（代表者と `audit_view` のメンバー）。
- 運営: `/admin/shop-claims` の店舗ごとの「操作ログ」。
- 記録するのは、メンバーの参加・抜ける・外す・権限変更・退会、招待の作成/取り消し、引き継ぎ、QR の発行/紐づけ/解除。**個人情報（メールアドレス・電話番号）は入れない**。退会したメンバーの名前は消える。

## 5. まだやっていないこと

- **運営アカウントの扱い**: 運営向けの旧い RLS（`vendors.id = auth.uid() and vendors.role = 'admin'`）は、そのまま残している（店舗のメンバー制とは別件。`is_operator()` への置き換えは別のタスク）。
- **プライバシーポリシー・利用規約**の改訂（出店者の情報・操作ログの扱い・退会時の削除範囲）。
- **複数店舗を持つ人**: 1 アカウントが入れる店舗は 1 つ（`shop_members_one_shop_per_user`）。必要になったら、この索引を外して店舗の切り替え画面を足す。
