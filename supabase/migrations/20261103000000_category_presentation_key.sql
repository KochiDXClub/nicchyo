-- 表示名と独立した表示キー。既知のIDを名前の一致より優先する。
alter table public.categories add column if not exists presentation_key text;
update public.categories set presentation_key = case id
  when '57b32c4e-0985-42be-af4b-e2869889cf94' then '生活雑貨'
  when '64b50182-b527-47a9-81c4-2fd1dc2681e9' then '植物・苗'
  when '5df86d0b-002d-4bf5-ac2e-500ec532adaa' then '道具・工具'
  when '53a731e3-c3fe-46c0-921a-36b27ccd63a4' then '食べ物'
  when 'a0457227-4a7c-42a3-aff6-6424661fd517' then '手作り・工芸'
  when 'a0ddb575-c6c6-4bf0-83a7-05528747a5e8' then '食材'
  when 'a333b487-8c16-428d-9708-1e8fe07d2bb4' then 'アクセサリー'
  else case
    when name in ('食材', '野菜・果物') then '食材'
    when name in ('食べ物', '道具・工具', '生活雑貨', '植物・苗', 'アクセサリー', '手作り・工芸') then name
    else null end
  end
where presentation_key is null;
-- 改名時はpresentation_keyを変更しない。新規の未設定カテゴリには共通の見た目を使う。
