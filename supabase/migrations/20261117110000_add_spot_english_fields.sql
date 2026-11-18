-- スポット（map_landmarks）の英語版。運営が日本語の名前・説明と一緒に管理画面で入力する（AI翻訳 → 確認・編集）。
-- 無ければ英語の画面でも日本語のまま出す。RLS・権限は map_landmarks の既存のものをそのまま使う。
-- restore_map_layout_snapshot は基本列だけを上書きするため、ここで追加した列は保持される。

alter table public.map_landmarks
  add column if not exists name_en text check (name_en is null or char_length(name_en) between 1 and 100),
  add column if not exists description_en text check (description_en is null or char_length(description_en) <= 400);

comment on column public.map_landmarks.name_en is 'スポットの英語名。null なら日本語名のまま表示する。';
comment on column public.map_landmarks.description_en is 'スポットの英語の説明。null なら日本語の説明のまま表示する。';
