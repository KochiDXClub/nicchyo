-- 店舗情報の翻訳（多言語対応。docs/I18N.md）。
--
-- 出店者は日本語だけで店の情報を入れる。外国人来訪者向けの訳は、AI が日本語から作って
-- ここに保存する（作るのは /api/admin/shop-translations。管理者または定期実行）。
-- 画面は保存済みの訳を読むだけなので、表示のたびに翻訳しない。
--
-- 1店舗 × 1言語で1行。日本語の元の内容が変わったかは source_hash で見分け、変わった店だけ訳し直す。
-- 訳せるのは「店名の読み」「ひとこと」「出店スタイル」「雨の日の対応」「商品名」。
-- 商品名は 日本語 → 訳 の対応表（jsonb）で持つ（商品は店ごとに数が違うため、行を分けない）。
--
-- 読めるのは、その店が一般に見える（vendors の RLS を通る）ときだけ。
-- 書き込みは service_role だけ（ポリシーを置かない）。

create table if not exists public.shop_translations (
  vendor_id     uuid not null references public.vendors (id) on delete cascade,
  locale        text not null check (locale ~ '^[a-z]{2}(-[A-Za-z]+)?$'),
  name          text,                                  -- 店名の読み（ローマ字など）
  strength      text,                                  -- ひとこと
  style         text,                                  -- 出店スタイル
  rain_policy   text,                                  -- 雨の日の対応
  products      jsonb not null default '{}'::jsonb,    -- { "日本語の商品名": "訳" }
  source_hash   text not null,                         -- 訳した時点の日本語の内容のハッシュ
  status        text not null default 'auto' check (status in ('auto', 'reviewed')),
  model         text,                                  -- 訳したモデル（品質の見直し用）
  updated_at    timestamptz not null default now(),
  primary key (vendor_id, locale)
);

comment on table public.shop_translations is
  '店舗情報の AI 翻訳（1店舗×1言語）。書き込みは service_role のみ。status=reviewed は人が確認した訳で、自動では上書きしない。';

alter table public.shop_translations enable row level security;
revoke all on public.shop_translations from anon, authenticated;
grant select on public.shop_translations to anon, authenticated;

-- vendors の RLS を通る（＝その人に見える店）の訳だけ読める
drop policy if exists "read translations of visible vendors" on public.shop_translations;
create policy "read translations of visible vendors"
  on public.shop_translations for select
  using (exists (select 1 from public.vendors v where v.id = shop_translations.vendor_id));

-- 翻訳に使うモデルを管理画面から選べるようにする。行が無くてもコード側の既定値（lib/ai/models.ts）で動く。
insert into ai_use_cases (key, label, description, sort_order) values
  (
    'translation',
    '店舗情報の翻訳',
    '出店者が入れた店名・ひとこと・商品名などを、外国人来訪者向けに訳す（保存した訳を画面に出す）。短い文を正確に訳す処理なので、軽いモデルで足りる。',
    60
  )
on conflict (key) do nothing;
