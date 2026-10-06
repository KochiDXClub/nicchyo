-- 出店者の画面ごとの説明パネル（「?」ボタン / 初回の自動表示）を、見たかどうか記録する。
--
-- 1行 = 「この出店者が、この画面の説明を「了解した」で閉じた」。行があれば自動表示しない。
-- 「?」ボタンからは何度でも見られるので、行があっても説明を見る妨げにはならない。
-- 端末を変えても再表示されないよう、localStorage ではなく出店者の行として持つ。
--
-- 出店者本人が自分の行を読み、足すだけ（更新・削除はしない）。
-- tour_key の値は lib/vendor/tours.ts の画面の名前と対応するが、増減のたびに
-- マイグレーションが要らないよう、DB では形（英小文字・数字・ハイフン）だけを縛る。

create table if not exists public.vendor_tour_seen (
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  tour_key text not null,
  seen_at timestamptz not null default now(),

  primary key (vendor_id, tour_key),
  constraint vendor_tour_seen_key_format check (tour_key ~ '^[a-z0-9][a-z0-9-]{0,39}$')
);

comment on table public.vendor_tour_seen is
  '出店者が、画面ごとの説明パネルを「了解した」で閉じた記録。行があれば初回の自動表示をしない。本人の行だけ読み書きできる。';

alter table public.vendor_tour_seen enable row level security;

-- Supabase は新しいテーブルに TRUNCATE を含む全権限を付ける。TRUNCATE は RLS を素通りするので剥がし、
-- 出店者本人が自分の行を読む・足す分だけ付け直す。
revoke all on public.vendor_tour_seen from anon, authenticated;
grant select, insert on public.vendor_tour_seen to authenticated;

drop policy if exists "vendors read own tour seen" on public.vendor_tour_seen;
create policy "vendors read own tour seen"
  on public.vendor_tour_seen for select to authenticated
  using ((select auth.uid()) = vendor_id);

drop policy if exists "vendors insert own tour seen" on public.vendor_tour_seen;
create policy "vendors insert own tour seen"
  on public.vendor_tour_seen for insert to authenticated
  with check ((select auth.uid()) = vendor_id);
