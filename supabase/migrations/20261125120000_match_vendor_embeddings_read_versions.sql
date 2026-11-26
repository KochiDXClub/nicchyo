-- 相談の店検索（match_vendor_embeddings）を、版の表 vendor_embedding_versions から直接読むように作り直す。
--
-- 従来は vendor_embeddings（ビュー）を経由していた。ビューは「有効な版」かつ「掲載許可」の絞り込みを
-- 持つが、検索の版の選び方が見えにくい。ここでは次の条件を関数の中に明示する。
-- - 版は embedding_versions で target = 'vendors' かつ active の1つだけ（公開されていない途中の版は読まない）
-- - 店は vendors.listing_status = 'allowed' のものだけ（掲載を取り下げたら即座に検索から外れる）
--
-- 引数と戻り値は変えない。呼び出し側（lib/grandma/vendorSearch.ts・itinerary）は変更不要。
-- 権限は 20261119054507 で付けたもの（service_role のみ実行可）を、念のため明示して付け直す。
-- ビュー vendor_embeddings は旧コードの参照のために残す。

create or replace function public.match_vendor_embeddings(
  query_embedding public.vector,
  match_count integer,
  match_threshold double precision
)
returns table (vendor_id uuid, similarity double precision)
language sql stable set search_path = ''
as $$
  select e.vendor_id, 1 - (e.embedding operator(public.<=>) query_embedding) as similarity
  from public.vendor_embedding_versions e
  join public.embedding_versions v
    on v.id = e.version_id and v.target = 'vendors' and v.active
  join public.vendors s
    on s.id = e.vendor_id and s.listing_status = 'allowed'
  where 1 - (e.embedding operator(public.<=>) query_embedding) > match_threshold
  order by e.embedding operator(public.<=>) query_embedding, e.vendor_id
  limit match_count;
$$;

revoke all on function public.match_vendor_embeddings(public.vector, integer, double precision)
  from public, anon, authenticated, service_role;
grant execute on function public.match_vendor_embeddings(public.vector, integer, double precision)
  to service_role;
