-- vendors.owner_name 列を削除する
--
-- 背景:
--   出店者本人の氏名は 20260807112200 で vendor_owner_profiles に分離済みだが、
--   元の vendors.owner_name 列は残ったままだった。
--   同じ個人情報が2箇所に存在すると、service role を使う API や
--   将来の GRANT 追加で再流出する温床になる（データ最小化の原則に反する）。
--   アプリコードの読み書きはすべて vendor_owner_profiles に移行済み。
--
-- 対策:
--   万一 vendor_owner_profiles に未移行の氏名が残っていれば
--   非公開（is_public = false）で退避したうえで、列を削除する。
--   （20260807112200 以降 vendors.owner_name は公開画面に表示されていないため、
--    退避分を非公開スタートにしても見え方は変わらない）

insert into public.vendor_owner_profiles (vendor_id, owner_name, is_public)
select id, owner_name, false
from public.vendors
where owner_name is not null
  and btrim(owner_name) <> ''
on conflict (vendor_id) do nothing;

alter table public.vendors drop column if exists owner_name;

-- 目的: 出店者氏名の二重管理をやめ、vendor_owner_profiles に一本化する。
