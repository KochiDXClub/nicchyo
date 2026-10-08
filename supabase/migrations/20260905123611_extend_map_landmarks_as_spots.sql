-- map_landmarks を「スポット」テーブルとして拡充する。
--
-- これまで map_landmarks は「マップ上に描く建物・電停の画像」だけを持ち、
-- お手洗い・休けい場所は lib/facilities/facilities.ts の静的配列だった。
-- タップで開くスポットカード（PR: spot-tap-card）とおでかけサポートの両方が
-- 同じデータを参照できるよう、1テーブルに統合する。
--
--   category     : transit（電停・駅）/ landmark（建物など）/ restroom / rest
--   transit_mode : tram / jr（category = transit のとき）
--   lines        : 乗り入れ路線（電停・駅）
--   tags         : 「屋根あり」「多目的あり」などの条件タグ
--   notes        : 設備・注意などの補足
--   external_url : 時刻表・公式サイト
--   photo_url    : 実景写真（Wikimedia Commons の CC ライセンス画像。出典は photo_credit）
--   open_from / open_until : 利用できる時間帯（'HH:MM'。未設定なら終日）
--   show_on_map  : マップに常時描画するか（お手洗い・休けいは false ＝ おでかけサポート時のみ）
--   verified     : 座標を実測・確認済みか（false のものは案内精度が保証されない）
--
-- 注意: 管理画面「マップ編集」のスナップショット復元（restore_map_layout_snapshot）は
-- 基本列（name/description/image_url/座標/サイズ/show_at_min_zoom）だけを上書きし、
-- ここで追加した列は保持する。スナップショットに無い key は削除されるため、
-- スポット管理画面で追加したスポットは、以後に保存したスナップショットに含まれる。

alter table map_landmarks
  add column if not exists category text not null default 'landmark',
  add column if not exists transit_mode text,
  add column if not exists lines text[] not null default '{}',
  add column if not exists tags text[] not null default '{}',
  add column if not exists notes text,
  add column if not exists external_url text,
  add column if not exists photo_url text,
  add column if not exists photo_credit text,
  add column if not exists open_from text,
  add column if not exists open_until text,
  add column if not exists show_on_map boolean not null default true,
  add column if not exists verified boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table map_landmarks drop constraint if exists map_landmarks_category_check;
alter table map_landmarks
  add constraint map_landmarks_category_check
  check (category in ('transit', 'landmark', 'restroom', 'rest'));

alter table map_landmarks drop constraint if exists map_landmarks_transit_mode_check;
alter table map_landmarks
  add constraint map_landmarks_transit_mode_check
  check (transit_mode is null or transit_mode in ('tram', 'jr'));

create index if not exists map_landmarks_category_idx on map_landmarks (category);

-- updated_at を自動更新
create or replace function set_map_landmarks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists map_landmarks_set_updated_at on map_landmarks;
create trigger map_landmarks_set_updated_at
  before update on map_landmarks
  for each row execute function set_map_landmarks_updated_at();

-- ─── 既存の電停・JR駅 ──────────────────────────────────────────────
update map_landmarks
set category = 'transit', transit_mode = 'tram', verified = true,
    external_url = 'https://www.tosaden.co.jp/train/timetable/'
where key like 'tram-%';

update map_landmarks
set category = 'transit', transit_mode = 'jr', verified = true,
    lines = array['土讃線'],
    external_url = 'https://www.jr-shikoku.co.jp/',
    photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/JR-Kochi-STA.jpg/960px-JR-Kochi-STA.jpg',
    photo_credit = '写真: MaedaAkihiko / CC BY-SA 4.0（Wikimedia Commons）'
where key = 'jr-kochi-station';

update map_landmarks set
  lines = array['後免線', '伊野線', '桟橋線', '駅前線'],
  notes = '4路線が乗り入れる乗り換えの中心。日曜市の東端から南へ徒歩5分ほどです。',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tosaden_Harimayabashi_Station_20150501_%2817464180556%29.jpg/960px-Tosaden_Harimayabashi_Station_20150501_%2817464180556%29.jpg',
  photo_credit = '写真: Kzaral / CC BY 2.0（Wikimedia Commons）'
where key = 'tram-harimayabashi';

update map_landmarks set
  lines = array['駅前線'],
  notes = 'JR高知駅方面へ向かう駅前線の停留場。日曜市の東端に近い乗り場です。',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Tosa-den_hasuikecho-dori_sta02n3200.jpg/960px-Tosa-den_hasuikecho-dori_sta02n3200.jpg',
  photo_credit = '写真: 663highland / CC BY 2.5（Wikimedia Commons）'
where key = 'tram-hasuikemachidori';

update map_landmarks set
  lines = array['伊野線'],
  notes = '帯屋町アーケード・ひろめ市場に近い停留場です。',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Ohashi_dori_tramstop.jpg/960px-Ohashi_dori_tramstop.jpg',
  photo_credit = '写真: Rsa / CC BY-SA 3.0（Wikimedia Commons）'
where key = 'tram-ohashidori';

update map_landmarks set
  lines = array['伊野線'],
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Tosa-den_horidume_sta01s3200.jpg/960px-Tosa-den_horidume_sta01s3200.jpg',
  photo_credit = '写真: 663highland / CC BY 2.5（Wikimedia Commons）'
where key = 'tram-horizume';

update map_landmarks set
  lines = array['伊野線'],
  notes = '高知城・日曜市の西の入口にいちばん近い停留場です。',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/16/Kochijo-mae-tramstop.jpg/960px-Kochijo-mae-tramstop.jpg',
  photo_credit = '写真: Rsa / CC BY-SA 3.0（Wikimedia Commons）'
where key = 'tram-kochijomae';

update map_landmarks set
  lines = array['駅前線'],
  notes = 'JR高知駅の南口すぐ。駅前線ではりまや橋方面へ向かえます。',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Tosaden_Kochi-Ekimae_Station_20150501_%2817303862569%29.jpg/960px-Tosaden_Kochi-Ekimae_Station_20150501_%2817303862569%29.jpg',
  photo_credit = '写真: Kzaral / CC BY 2.0（Wikimedia Commons）'
where key = 'tram-kochiekimae';

-- ─── 建物などの目印 ────────────────────────────────────────────────
update map_landmarks set
  tags = array['木かげあり', 'ベンチあり'],
  external_url = 'https://kochipark.jp/kochijyo/',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Kochi_Castle08s3872.jpg/960px-Kochi_Castle08s3872.jpg',
  photo_credit = '写真: 663highland / CC BY 2.5（Wikimedia Commons）'
where key = 'castle';

update map_landmarks set
  tags = array['屋内', '飲食', 'お手洗いあり', '屋根あり'],
  external_url = 'https://hirome.co.jp/',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Hirome_Market_Entrance.jpg/960px-Hirome_Market_Entrance.jpg',
  photo_credit = '写真: Tzu-hsun, Hsu / CC BY-SA 4.0（Wikimedia Commons）'
where key = 'hirome-market';

update map_landmarks set
  tags = array['屋内', 'お手洗いあり'],
  external_url = 'https://otepia.kochi.jp/',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Otepia_Kochi_Library_ac_%283%29.jpg/960px-Otepia_Kochi_Library_ac_%283%29.jpg',
  photo_credit = '写真: Asturio Cantabrio / CC BY-SA 4.0（Wikimedia Commons）'
where key = 'otepia';

update map_landmarks set
  tags = array['屋内'],
  external_url = 'https://www.kochi-johaku.jp/',
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/56/Kochi_Castle_Museum_of_History_01.jpg/960px-Kochi_Castle_Museum_of_History_01.jpg',
  photo_credit = '写真: Higa4 / CC0（Wikimedia Commons）'
where key = 'museum';

update map_landmarks set
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Kochi_Otemae_High_School_ac_%283%29.jpg/960px-Kochi_Otemae_High_School_ac_%283%29.jpg',
  photo_credit = '写真: Asturio Cantabrio / CC BY-SA 4.0（Wikimedia Commons）'
where key = 'ohtemae-school';

update map_landmarks set
  photo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Tosaden_631_tram_20200725_%2850184254737%29.jpg/960px-Tosaden_631_tram_20200725_%2850184254737%29.jpg',
  photo_credit = '写真: 7beachbum / CC BY 2.0（Wikimedia Commons）'
where key = 'densha';

-- ─── お手洗い・休けい場所（lib/facilities/facilities.ts の静的データを移行）───
-- 座標は追手筋の実座標を基準にした暫定値（verified = false）。
-- マップには常時描画しない（show_on_map = false）。
insert into map_landmarks (
  key, name, description, image_url, latitude, longitude, width_px, height_px, show_at_min_zoom,
  category, tags, notes, photo_url, photo_credit, show_on_map, verified
)
values
  (
    'restroom-central-park', '中央公園 公衆お手洗い', '会場の中ほど・中央公園内',
    '/images/maps/elements/facilities/restroom.svg', 33.5609, 133.5376, 40, 40, false,
    'restroom', array['多目的あり'],
    '日曜市の通りから南へすぐ。会場のどこからでも向かいやすい場所です。',
    null, null, false, false
  ),
  (
    'restroom-kochi-castle', '高知公園（高知城前）公衆お手洗い', '会場の西のはし・追手門のそば',
    '/images/maps/elements/facilities/restroom.svg', 33.5607, 133.5341, 40, 40, false,
    'restroom', array['多目的あり'],
    '日曜市の西の入口から歩いてすぐです。',
    null, null, false, false
  ),
  (
    'restroom-hirome', 'ひろめ市場', '会場から南へ徒歩3分ほど',
    '/images/maps/elements/facilities/restroom.svg', 33.5598, 133.5346, 40, 40, false,
    'restroom', array['屋内'],
    '館内のお手洗いを利用できます。混み合う時間帯があります。',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Hirome_Market_Entrance.jpg/960px-Hirome_Market_Entrance.jpg',
    '写真: Tzu-hsun, Hsu / CC BY-SA 4.0（Wikimedia Commons）', false, false
  ),
  (
    'restroom-obiyamachi', '帯屋町アーケード周辺の商業施設', '会場から南へ徒歩5分ほど',
    '/images/maps/elements/facilities/restroom.svg', 33.5601, 133.5367, 40, 40, false,
    'restroom', array['屋内'],
    'アーケード内の各施設で利用できます。営業時間内のみです。',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Obiyamachi_1st_Shopping_Street_ac_%282%29.jpg/960px-Obiyamachi_1st_Shopping_Street_ac_%282%29.jpg',
    '写真: Asturio Cantabrio / CC BY-SA 4.0（Wikimedia Commons）', false, false
  ),
  (
    'rest-central-park', '中央公園', '会場の中ほど・南がわ',
    '/images/maps/elements/facilities/rest.svg', 33.5610, 133.5379, 40, 40, false,
    'rest', array['ベンチあり'],
    'ベンチと広場があります。買ったものをその場で食べるのにも向いています。',
    null, null, false, false
  ),
  (
    'rest-kochi-castle-park', '高知公園（高知城のふもと）', '会場の西のはし',
    '/images/maps/elements/facilities/rest.svg', 33.5605, 133.5338, 40, 40, false,
    'rest', array['木かげあり', 'ベンチあり'],
    '木かげとベンチがあります。人が少なめで落ち着けます。',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Kochi_Castle08s3872.jpg/960px-Kochi_Castle08s3872.jpg',
    '写真: 663highland / CC BY 2.5（Wikimedia Commons）', false, false
  ),
  (
    'rest-hirome', 'ひろめ市場', '会場から南へ徒歩3分ほど',
    '/images/maps/elements/facilities/rest.svg', 33.5598, 133.5346, 40, 40, false,
    'rest', array['屋内', '屋根あり'],
    '屋根のある飲食スペースです。雨の日の避難先にもなります。',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Hirome_Market_Entrance.jpg/960px-Hirome_Market_Entrance.jpg',
    '写真: Tzu-hsun, Hsu / CC BY-SA 4.0（Wikimedia Commons）', false, false
  ),
  (
    'rest-obiyamachi', '帯屋町アーケード', '会場から南へ徒歩5分ほど',
    '/images/maps/elements/facilities/rest.svg', 33.5601, 133.5372, 40, 40, false,
    'rest', array['屋根あり'],
    '屋根つきの通りです。日ざしや雨をよけながら休めます。',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Obiyamachi_1st_Shopping_Street_ac_%282%29.jpg/960px-Obiyamachi_1st_Shopping_Street_ac_%282%29.jpg',
    '写真: Asturio Cantabrio / CC BY-SA 4.0（Wikimedia Commons）', false, false
  )
on conflict (key) do nothing;

-- 変更の目的:
--   店舗以外のスポット（電停・駅・建物・お手洗い・休けい）を1テーブルで管理し、
--   スポットカードとおでかけサポートが写真・路線・条件タグを共有できるようにする。
