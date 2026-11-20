-- 市ごとの地図マーカーの色。管理画面の「市の管理」で変えられる。
-- 日曜市は今の見た目（出店者のいる区画のオレンジ）のまま。ほかの市は初期値の青緑から始める。
alter table public.markets
  add column if not exists marker_color text not null default '#0D9488'
  check (marker_color ~ '^#[0-9A-Fa-f]{6}$');

comment on column public.markets.marker_color is '地図の区画マーカーの色（#RRGGBB）';

update public.markets set marker_color = '#D97706' where slug = 'nichiyo';
