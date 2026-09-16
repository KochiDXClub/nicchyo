-- =====================================================================
-- AIプロンプトのDB管理（ai_prompts）
--
-- 目的: 運営が現場で気づいたプロンプトの調整（「土佐弁が過剰」など）を、
--       コード変更 → PR → デプロイを待たずに反映できるようにする。
--       日曜市は週1回しか開催されないため、次の日曜に間に合わないのは実損。
--
-- system_settings ではなく専用テーブルにする理由:
--   system_settings は key ごとの上書きなので履歴が残らない。
--   プロンプトは壊れやすく、壊れたときに「昨日の状態に戻す」が最速の復旧手段になる。
--   version を積んで is_active を差し替える形にし、過去バージョンへ戻せるようにする。
--
-- 初期行は入れない。テーブルが空のときはコード側の既定値
-- （lib/grandma/prompts/ の各定数）にフォールバックする。
-- ここにプロンプト文を焼くとコード側と二重管理になり、必ずズレるため。
-- =====================================================================

create table if not exists ai_prompts (
  id uuid primary key default gen_random_uuid(),
  -- 編集単位のキー。lib/grandma/prompts/promptKeys.ts の AI_PROMPT_DEFS と対応する
  key text not null,
  body text not null,
  -- 同じ key の中での通し番号。1 から始めて編集のたびに増える
  version integer not null default 1,
  -- 現在使われている行。key ごとに最大1行だけ true
  is_active boolean not null default true,
  -- 運営が残す変更理由（「土佐弁を弱めた」など）
  note text,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),

  constraint ai_prompts_key_not_blank check (btrim(key) <> ''),
  constraint ai_prompts_key_length check (char_length(key) <= 100),
  constraint ai_prompts_version_positive check (version >= 1),
  -- DBの値がそのまま system prompt に入るので、長さはDB側でも止める。
  -- アプリ側（promptKeys.ts の maxLength）はこれより短い上限を持つ
  constraint ai_prompts_body_length check (char_length(body) <= 4000),
  constraint ai_prompts_note_length check (note is null or char_length(note) <= 200)
);

-- 同じ key に同じ version を2つ作らない
create unique index if not exists ai_prompts_key_version_idx
  on ai_prompts (key, version);

-- key ごとにアクティブ行は1つだけ。
-- 旧アクティブ行を降ろすのと version の採番はトリガでやるので、
-- 書き込み側（管理API）は insert 1文だけで済む
create unique index if not exists ai_prompts_active_key_idx
  on ai_prompts (key)
  where is_active;

-- 履歴一覧（新しい順）
create index if not exists ai_prompts_key_version_desc_idx
  on ai_prompts (key, version desc);

-- ─── version 採番とアクティブ行の切り替え ──────────────────────────────
-- 「旧アクティブ行を false にする」→「新しい version を insert」を
-- 呼び出し側の2文に分けると、間で落ちたときにアクティブ行なしの状態が残り、
-- 同時編集では version がぶつかる。DB側で1文に閉じる。
create or replace function public.ai_prompts_activate_new_version()
returns trigger
language plpgsql
-- security definer にはしない。書き込むのは RLS をバイパスする service role だけで、
-- 権限を昇格させる理由がない
set search_path = public
as $$
begin
  -- 過去の版は書き換えられない。履歴が信用できないと「昨日の状態に戻す」が成り立たない
  if tg_op = 'UPDATE'
     and (new.body is distinct from old.body
       or new.key is distinct from old.key
       or new.version is distinct from old.version) then
    raise exception '過去の版は書き換えられません。新しい version を insert してください'
      using errcode = '42501';
  end if;

  -- version は呼び出し側に決めさせない（同時編集でのユニーク違反を避ける）
  if tg_op = 'INSERT' then
    new.version := coalesce(
      (select max(version) + 1 from public.ai_prompts where key = new.key),
      1
    );
  end if;

  -- 新しい行を active にするとき、同じ key の旧 active を降ろす
  if new.is_active then
    update public.ai_prompts
       set is_active = false
     where key = new.key
       and is_active
       and id is distinct from new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists ai_prompts_activate_new_version on ai_prompts;
create trigger ai_prompts_activate_new_version
  before insert or update on ai_prompts
  for each row execute function public.ai_prompts_activate_new_version();

-- ─── 権限 ──────────────────────────────────────────────────────────────
alter table ai_prompts enable row level security;

-- 読み書きはすべてサーバー側（service role）から行う。service role は RLS を
-- バイパスするので、ブラウザ由来のロールには一切権限を渡さない。
--
-- Supabase は public スキーマの新規テーブルに anon / authenticated への権限を
-- 既定で付ける（このリポジトリに alter default privileges での一括剥奪はない）。
-- RLS だけに頼らず GRANT も明示的に剥がす。
-- 先例: 20260807112100_close_anon_access_on_unused_tables.sql
revoke all on public.ai_prompts from anon, authenticated;

-- ポリシーは作らない。
--
-- ai_prompts の body は system prompt にそのまま連結されるので、露出面は
-- できるだけ小さくしておきたい。ブラウザから直接読ませる必要が出た場合でも、
-- 管理者判定は JWT の app_metadata.role だけを見ること
-- （lib/auth/permissions.ts の getRole() と同じ基準。先例は
--  20260903163238_create_map_perf_runs.sql）。
-- 古いマイグレーションには別の判定式を使っているものがあるが、引き写さない。
-- super_admin は 20260806104907_unify_super_admin_into_admin.sql で
-- admin に統合済みなので、判定値は 'admin' だけでよい。
--
--   create policy "admins read ai prompts"
--     on public.ai_prompts for select to authenticated
--     using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
--   grant select on public.ai_prompts to authenticated;
