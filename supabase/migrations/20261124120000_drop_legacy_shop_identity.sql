-- 旧店舗番号（場所の番号）の対応表を削除する。
-- 確定・取消の行は0件であることを確認済み。店舗 ID（vendors.public_shop_id）と公開切替は残す。
drop trigger if exists legacy_shop_identity_revocation_immutable on public.legacy_shop_identity_revocations;
drop function if exists public.protect_legacy_shop_identity_revocation();
drop table if exists public.legacy_shop_identity_revocations;

drop view if exists public.legacy_shop_identity_candidates;

drop trigger if exists legacy_shop_identity_alias_immutable on public.legacy_shop_identity_aliases;
drop function if exists public.protect_legacy_shop_identity_alias();
drop table if exists public.legacy_shop_identity_aliases;
