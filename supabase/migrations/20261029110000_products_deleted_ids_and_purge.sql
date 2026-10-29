-- 目的: 地図の店舗キャッシュの差分更新で、論理削除した商品を検知できるようにし、
-- 論理削除から時間が経った行を物理的に消す。
-- 前提: 20261029100000_products_soft_delete_and_updated_at_triggers.sql

-- ── 削除された商品の id 一覧 ─────────────────────────────────────────
-- 論理削除した行は RLS で誰にも読ませない（来訪者の anon も同じ）。そのままでは、差分クエリを
-- 来訪者と同じ anon クライアントで実行するキャッシュが、削除を知る手段がない。
-- そこで「削除された商品の id と、いつ変わったか」だけを返す関数を用意する。
-- 返すのは uuid だけ（商品名・店舗・説明などは含めない）ので、公開しても害がない。
create or replace function public.list_deleted_product_ids(p_since timestamptz)
returns table (id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
    from public.products p
   where p.deleted_at is not null
     -- 誰でも呼べるので、遠い過去を指定して大量に返させないよう 30 日前までに絞る
     and p.updated_at > greatest(p_since, now() - interval '30 days')
   order by p.updated_at, p.id
   limit 10000;
$$;

revoke execute on function public.list_deleted_product_ids(timestamptz) from public;
grant execute on function public.list_deleted_product_ids(timestamptz) to anon, authenticated, service_role;

-- ── 論理削除した商品を物理的に消す ───────────────────────────────────
-- 差分更新は「前回から変わった行」だけを見るので、論理削除した行は全インスタンスが
-- 削除を知るまで残す必要がある。キャッシュは遅くとも 1 日で全件を読み直すため、7 日で十分。
-- 消すと product_seasons（on delete cascade）も一緒に消える。
create or replace function public.purge_deleted_products(p_retention interval default interval '7 days')
returns integer
language plpgsql
set search_path = ''
as $$
declare
  removed integer;
begin
  delete from public.products
   where deleted_at is not null
     and deleted_at < now() - p_retention;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- クライアントからは実行不可（pg_cron / service role のみ）
revoke execute on function public.purge_deleted_products(interval) from public;
revoke execute on function public.purge_deleted_products(interval) from anon;
revoke execute on function public.purge_deleted_products(interval) from authenticated;
grant execute on function public.purge_deleted_products(interval) to service_role;

-- pg_cron で毎日 18:30 UTC（日本時間 3:30）に実行する。
-- pg_cron が使えない環境ではスケジュール登録をスキップし、関数のみ作成する
-- （手動実行: select public.purge_deleted_products();）
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    -- 同名ジョブがあれば置き換え
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'purge-deleted-products';

    perform cron.schedule(
      'purge-deleted-products',
      '30 18 * * *',
      'select public.purge_deleted_products()'
    );
  else
    raise notice 'pg_cron is not available; run public.purge_deleted_products() manually or via an external scheduler';
  end if;
end $$;
