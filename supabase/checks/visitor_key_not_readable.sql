-- ai_consult_logs / content_reactions の visitor_key を、anon / authenticated が読めないことを確かめる（#1069 PR-A）。
--   - anon: 両表とも SELECT できない（どの列も）
--   - authenticated: visitor_key を select すると permission denied（select * も同様）
--   - authenticated: 出店者の画面が読む列（id の件数 / intent_category, keywords, is_recommendation など）は読める
--   - service_role: visitor_key を引き続き読める
-- あわせて、2 表の列のうち「visitor_key だけ」が authenticated から読めないこと
-- （将来の列追加で付け忘れ・付けすぎが起きたときに気づけるように、列の一覧で突き合わせる）。
--
-- 使い方（CI の Migrations Check で実行している）:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/checks/visitor_key_not_readable.sql

begin;

-- ── 権限の表（has_column_privilege）で突き合わせる ─────────────────────
do $$
declare
  bad text;
begin
  -- anon は両表のどの列も読めない
  select string_agg(format('%s.%s', c.table_name, c.column_name), ', ')
    into bad
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name in ('ai_consult_logs', 'content_reactions')
    and has_column_privilege('anon', format('public.%I', c.table_name), c.column_name, 'SELECT');
  if bad is not null then
    raise exception 'anon が読める列が残っています: %', bad;
  end if;

  -- authenticated は visitor_key だけが読めない
  select string_agg(format('%s.%s', c.table_name, c.column_name), ', ')
    into bad
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name in ('ai_consult_logs', 'content_reactions')
    and c.column_name = 'visitor_key'
    and has_column_privilege('authenticated', format('public.%I', c.table_name), c.column_name, 'SELECT');
  if bad is not null then
    raise exception 'authenticated が visitor_key を読めます: %', bad;
  end if;

  -- 読ませてよい列を明示して、実際の列と突き合わせる（pg_attribute は権限に左右されない）。
  -- 列を足したときは、出店者に読ませてよいかを判断してから、ここと migration の grant select の両方に足す。
  -- CI を通すために、visitor_key のような識別子へ grant select (…) を付けてはいけない。
  declare
    expected_ai constant text[] := array['consulted_at','created_at','id','intent_category','is_recommendation','keywords','location_type','store_id'];
    expected_cr constant text[] := array['created_at','id','vendor_content_id'];
    actual text[];
  begin
    select array_agg(attname::text order by attname) into actual
    from pg_attribute
    where attrelid = 'public.ai_consult_logs'::regclass and attnum > 0 and not attisdropped and attname <> 'visitor_key';
    if actual is distinct from expected_ai then
      raise exception 'ai_consult_logs の列が想定と違います（実際: %, 想定: %）。列を足したなら、読ませてよいか判断して allowlist と grant の両方に足してください', actual, expected_ai;
    end if;
    if not exists (select 1 from pg_attribute where attrelid = 'public.ai_consult_logs'::regclass and attname = 'visitor_key' and not attisdropped) then
      raise exception 'ai_consult_logs.visitor_key が見つかりません（改名・削除されたなら、この check も更新してください）';
    end if;

    select array_agg(attname::text order by attname) into actual
    from pg_attribute
    where attrelid = 'public.content_reactions'::regclass and attnum > 0 and not attisdropped and attname <> 'visitor_key';
    if actual is distinct from expected_cr then
      raise exception 'content_reactions の列が想定と違います（実際: %, 想定: %）。列を足したなら、読ませてよいか判断して allowlist と grant の両方に足してください', actual, expected_cr;
    end if;
    if not exists (select 1 from pg_attribute where attrelid = 'public.content_reactions'::regclass and attname = 'visitor_key' and not attisdropped) then
      raise exception 'content_reactions.visitor_key が見つかりません（改名・削除されたなら、この check も更新してください）';
    end if;

    -- allowlist の列すべてに authenticated の SELECT が付いている（出店者の画面が読める）
    select string_agg(format('%s.%s', t.tbl, col), ', ')
      into bad
    from (
      select 'ai_consult_logs' as tbl, unnest(expected_ai) as col
      union all
      select 'content_reactions', unnest(expected_cr)
    ) t
    where not has_column_privilege('authenticated', format('public.%I', t.tbl), t.col, 'SELECT');
    if bad is not null then
      raise exception '出店者の画面が読む列に SELECT が付いていません: %', bad;
    end if;
  end;

  -- service_role は従来どおり visitor_key を読める（API の書き込み・参照はここ経由）
  if not has_column_privilege('service_role', 'public.ai_consult_logs', 'visitor_key', 'SELECT')
     or not has_column_privilege('service_role', 'public.content_reactions', 'visitor_key', 'SELECT') then
    raise exception 'service_role が visitor_key を読めなくなっています';
  end if;
end $$;

-- ── 実際にクエリを流して確かめる ────────────────────────────────────────
-- anon: 表そのものが読めない
set local role anon;
do $$ begin
  begin
    perform 1 from public.ai_consult_logs limit 1;
    raise exception 'anon が ai_consult_logs を読めました';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.content_reactions limit 1;
    raise exception 'anon が content_reactions を読めました';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- authenticated: visitor_key は読めず、画面が使う列は読める
set local role authenticated;
do $$ begin
  begin
    perform visitor_key from public.ai_consult_logs limit 1;
    raise exception 'authenticated が ai_consult_logs.visitor_key を読めました';
  exception when insufficient_privilege then null; end;
  begin
    perform visitor_key from public.content_reactions limit 1;
    raise exception 'authenticated が content_reactions.visitor_key を読めました';
  exception when insufficient_privilege then null; end;
  -- select * は visitor_key を含むので失敗する（列を明示する必要がある）
  begin
    perform * from public.ai_consult_logs limit 1;
    raise exception 'authenticated が ai_consult_logs を select * で読めました';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.content_reactions limit 1;
    raise exception 'authenticated が content_reactions を select * で読めました';
  exception when insufficient_privilege then null; end;
  -- WHERE / ORDER BY / GROUP BY でも visitor_key は使えない（推測に使わせない）
  begin
    perform 1 from public.content_reactions where visitor_key = 'x';
    raise exception 'authenticated が visitor_key で絞り込めました';
  exception when insufficient_privilege then null; end;
end $$;

-- 出店者の画面と同じ形のクエリ（RLS で行は 0 件でも、権限エラーにならないこと）
select count(id) from public.content_reactions;
select count(id) from public.content_reactions where created_at >= now() - interval '7 days';
select intent_category, keywords, is_recommendation from public.ai_consult_logs where store_id = 'x' and consulted_at >= now() - interval '7 days';
select keywords from public.ai_consult_logs where store_id = 'x' order by consulted_at desc limit 1000;
select count(id) from public.ai_consult_logs where store_id = 'x' and is_recommendation = true;
-- SECURITY INVOKER の件数集計（20260719181656）は visitor_key を使わないので、権限エラーにならないこと
select * from public.get_reaction_counts(array[]::uuid[]);
reset role;

-- service_role: visitor_key を読める
set local role service_role;
select visitor_key from public.ai_consult_logs limit 1;
select visitor_key from public.content_reactions limit 1;
reset role;

rollback;
