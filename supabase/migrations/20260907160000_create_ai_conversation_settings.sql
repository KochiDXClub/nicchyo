-- =====================================================================
-- 相談の会話設定（ai_conversation_settings）
--
-- 目的:
--   発話数・返答の長さ・履歴の参照件数を、コードを直さず運営が変えられる
--   ようにする。
--
--   これらは「日曜市を知っている人が現地の感触で決める」値で、正解が
--   コード側にない。長すぎれば読まれず、短すぎれば案内にならない。
--   そのたびにコード変更 → PR → デプロイを待つと、調整が週をまたぐ。
--   プロンプトをDBに逃がしたのと同じ理由（#567）。
--
-- ★ このテーブルの限界を明記しておく。
--   行を足しても新しい設定は生まれない。実際に値を読むのはコード側
--   （resolveAiConversationSettings() → ask/route.ts）で、行はそれに
--   対応する台帳。コードに無い key の行は、どこからも参照されない行が
--   増えるだけになる。そのため insert は API から塞いである
--   （update のみ。型でも Insert: never）。
--   コード側の定義は lib/ai/conversationSettings.ts。
--   ズレは lib/ai/conversationSettings.test.ts が止める。
--
-- 上下限を行に持たせているのは、値を間違えたときの被害がキーごとに
-- 違うため。発話数を10にすれば吹き出しが10個並び、返答の長さを50に
-- すれば文の途中で切れる。DBのCHECK制約と読み取り側の両方で挟む。
-- =====================================================================

-- ─── 設定の一覧 ────────────────────────────────────────────────────────
create table if not exists ai_conversation_settings (
  -- 設定のキー。lib/ai/conversationSettings.ts の定義と対応する
  key text primary key,
  -- 管理画面の見出し
  label text not null,
  -- 管理画面の説明文。運営が何を決める値なのか分かる言葉にする
  description text not null default '',
  -- 運営が決めた値
  value integer not null,
  -- 受け付ける範囲。キーごとに違う（マイグレーションが正本）
  min_value integer not null,
  max_value integer not null,
  -- 管理画面の並び順
  sort_order integer not null default 0,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint ai_conversation_settings_bounds_sane check (min_value <= max_value),
  -- 範囲外の値を保存できないようにする。
  -- 読み取り側（normalizeAiConversationSettings）も同じ範囲で挟むが、
  -- APIを介さない書き込み（SQLエディタでの手直しなど）はここでしか止まらない
  constraint ai_conversation_settings_value_in_bounds
    check (value between min_value and max_value)
);

-- ─── 更新時刻 ──────────────────────────────────────────────────────────
create or replace function public.ai_conversation_settings_touch_updated_at()
returns trigger
language plpgsql
-- 権限を昇格させる理由がない
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.ai_conversation_settings_touch_updated_at()
  from public, anon, authenticated;

drop trigger if exists ai_conversation_settings_touch_updated_at on ai_conversation_settings;
create trigger ai_conversation_settings_touch_updated_at
  before update on ai_conversation_settings
  for each row execute function public.ai_conversation_settings_touch_updated_at();

-- ─── 初期データ ────────────────────────────────────────────────────────
-- 見出し・説明・上下限はマイグレーションを正本にする（do update で直せる）。
-- value は運営が決めた値なので触らない。
insert into ai_conversation_settings
  (key, label, description, value, min_value, max_value, sort_order)
values
  (
    'consult.max_turns',
    '1回の返答の発話数',
    '1回の返答で出す吹き出しの数の上限。2以上にすると1秒ずつ間をあけて順に出るため、同じキャラでも掛け合いのように見える。',
    1, 1, 3, 10
  ),
  (
    'consult.max_output_tokens',
    '返答の長さ（最大トークン数）',
    'AIが1回に生成できる長さの上限。短すぎると文の途中で切れ、長すぎると読まれずに流される。目安は300〜700。',
    500, 200, 1200, 20
  ),
  (
    'consult.history_limit',
    'AIに渡す直近の会話の件数',
    '「さっきの話」をどこまで覚えているか。多いほど文脈は続くが、古いやり取りの言い回しを真似しやすくなる。',
    6, 0, 12, 30
  )
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  min_value = excluded.min_value,
  max_value = excluded.max_value,
  sort_order = excluded.sort_order;

-- ─── 権限 ──────────────────────────────────────────────────────────────
alter table ai_conversation_settings enable row level security;

-- 読み書きはすべてサーバー側（service role）から行う。service role は RLS を
-- バイパスするので、ブラウザ由来のロールには一切権限を渡さない。
--
-- Supabase は public スキーマの新規テーブルに anon / authenticated への権限を
-- 既定で付ける（このリポジトリに alter default privileges での一括剥奪はない）。
-- RLS だけに頼らず GRANT も明示的に剥がす。
-- 先例: 20260906120000_create_ai_prompts.sql
revoke all on public.ai_conversation_settings from anon, authenticated;

-- ポリシーは作らない。
--
-- ブラウザから直接読ませる必要が出た場合でも、管理者判定は JWT の
-- app_metadata.role だけを見ること（lib/auth/permissions.ts の getRole() と
-- 同じ基準。user_metadata は本人が書き換えられるので判定に使わない）。
-- 古いマイグレーションには別の判定式を使っているものがあるが、引き写さない。
--
--   create policy "admins read ai conversation settings"
--     on public.ai_conversation_settings for select to authenticated
--     using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
--   grant select on public.ai_conversation_settings to authenticated;
