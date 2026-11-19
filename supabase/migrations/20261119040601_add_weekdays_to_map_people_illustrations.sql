alter table public.map_people_illustrations add column weekdays smallint[];

-- 保存済みの配置は、これまで表示されていた市の通常開催曜日を引き継ぐ。
update public.map_people_illustrations as illustration
set weekdays = array[market.weekday]::smallint[]
from public.markets as market
where market.id = illustration.market_id;

alter table public.map_people_illustrations
  alter column weekdays set not null,
  add constraint map_people_illustrations_weekdays_check check (
    array_ndims(weekdays) = 1
    and cardinality(weekdays) between 1 and 7
    and array_position(weekdays, null) is null
    and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  );

comment on column public.map_people_illustrations.weekdays is 'この配置を表示する日本時間の曜日。0=日曜、6=土曜。';
