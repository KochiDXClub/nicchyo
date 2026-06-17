-- =====================================================================
-- クーポン機能の廃止
-- =====================================================================
-- アプリからクーポン機能を全廃したため、関連するDBオブジェクトを削除する。
-- 対象:
--   - redeem_coupon RPC 関数
--   - coupon_redemption_logs / coupon_stamps / coupon_issuances
--   - vendor_coupon_settings / coupon_types
--   - coupon_impressions（解析用）
--   - system_settings の 'coupon' キー
-- 依存関係（FK・インデックス・RLSポリシー）は CASCADE でまとめて削除する。
-- =====================================================================

-- ─── RPC 関数 ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS redeem_coupon(uuid, text, uuid, date, integer, integer);

-- ─── テーブル群 ───────────────────────────────────────────────────────
DROP TABLE IF EXISTS coupon_redemption_logs CASCADE;
DROP TABLE IF EXISTS coupon_stamps          CASCADE;
DROP TABLE IF EXISTS coupon_issuances       CASCADE;
DROP TABLE IF EXISTS vendor_coupon_settings CASCADE;
DROP TABLE IF EXISTS coupon_types           CASCADE;
DROP TABLE IF EXISTS coupon_impressions     CASCADE;

-- ─── system_settings のクーポン設定を削除 ─────────────────────────────
DELETE FROM system_settings WHERE key = 'coupon';
