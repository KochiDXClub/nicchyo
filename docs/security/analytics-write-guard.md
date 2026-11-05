# 閲覧ログの直接書き込みの閉鎖

深刻度: **中**。リポジトリ監査は PR #1010 の `docs/security/2026-11-04-review.md` を参照。本PRは画像の非公開化と独立し、developへ単独でマージできる。

`web_page_analytics` の公開INSERTポリシーとanon/authenticatedの権限により、APIの同一オリジン確認・レート制限・パス/ロール検証を通らず、偽の統計を投入できる。
Cookieクライアントは本人の確認だけに使い、検証済みのログはservice roleで保存する。未設定なら503で閉じ、旧クライアントへフォールバックしない。SQLで直接INSERTを拒否し、既存SELECTは維持する。

画像のDB・Storage移行は不要。アプリと `20261104110000_close_web_analytics_direct_insert.sql` を同じリリースで適用する。旧コードだけが残る間は記録に失敗するためPreviewで確認する。本番への適用はこの作業では実行しない。

検証はAPIのservice role保存・未設定時の拒否のテスト、および実ロールでの `supabase/checks/web_analytics_writes.sql`。CIのMigrations Checkでも全適用後に実行する。
