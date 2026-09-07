-- =====================================================================
-- 場面ごとのAIモデル設定（ai_model_settings）
--
-- 目的: 相談・店舗チャット・回り方プラン・マップAIで使うモデルを、
--       運営が管理画面から場面ごとに選べるようにする。
--       モデルの世代交代は数か月おきに起きるが、そのたびにコード変更 → PR →
--       デプロイを待つと、速度や品質の劣化をその週の日曜市に持ち込むことになる。
--
-- ai_prompts と違って版を積まない。
--   プロンプトは自由文なので「昨日の文面」を復元する手段が要るが、
--   モデルは lib/ai/models.ts の許可リストから選ぶだけで、選択肢は画面に
--   すべて見えている。戻すのは選び直すのと同じ操作なので、履歴を積むより
--   1場面1行の方が読みやすい。誰がいつ変えたかは admin_audit_logs に残す。
--
-- 初期行は入れない。テーブルが空のときはコード側の既定値
-- （lib/ai/models.ts の AI_USE_CASE_DEFS.defaultModelId）にフォールバックする。
-- ここにモデル名を焼くとコード側と二重管理になり、必ずズレるため。
-- =====================================================================

create table if not exists ai_model_settings (
  -- 使う場面。lib/ai/models.ts の AI_USE_CASE_DEFS と対応する
  use_case text primary key,
  -- OpenAI に渡す model 名。lib/ai/models.ts の AI_MODEL_DEFS と対応する
  model_id text not null,
  -- 推論の深さ。推論しないモデルでは null
  reasoning_effort text,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint ai_model_settings_use_case_not_blank check (btrim(use_case) <> ''),
  constraint ai_model_settings_use_case_length check (char_length(use_case) <= 50),
  constraint ai_model_settings_model_id_not_blank check (btrim(model_id) <> ''),
  -- 値そのものの妥当性はアプリ側の許可リスト（validateAiModelChoice）で見る。
  -- ここでモデル名を列挙すると、モデルを1つ増やすたびにマイグレーションが要る
  constraint ai_model_settings_model_id_length check (char_length(model_id) <= 100),
  constraint ai_model_settings_reasoning_effort_valid check (
    reasoning_effort is null
    or reasoning_effort in ('none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max')
  )
);

-- ─── 更新日時 ──────────────────────────────────────────────────────────
-- upsert のたびに呼び出し側が now() を書くのを忘れると、いつ変えたか分からなくなる
create or replace function public.ai_model_settings_touch_updated_at()
returns trigger
language plpgsql
-- security definer にはしない。書き込むのは RLS をバイパスする service role だけで、
-- 権限を昇格させる理由がない
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ai_model_settings_touch_updated_at on ai_model_settings;
create trigger ai_model_settings_touch_updated_at
  before insert or update on ai_model_settings
  for each row execute function public.ai_model_settings_touch_updated_at();

-- ─── 権限 ──────────────────────────────────────────────────────────────
alter table ai_model_settings enable row level security;

-- 読み書きはすべてサーバー側（service role）から行う。service role は RLS を
-- バイパスするので、ブラウザ由来のロールには一切権限を渡さない。
--
-- Supabase は public スキーマの新規テーブルに anon / authenticated への権限を
-- 既定で付ける（このリポジトリに alter default privileges での一括剥奪はない）。
-- RLS だけに頼らず GRANT も明示的に剥がす。
-- 先例: 20260906120000_create_ai_prompts.sql
revoke all on public.ai_model_settings from anon, authenticated;

-- ポリシーは作らない。
--
-- ブラウザから直接読ませる必要が出た場合でも、管理者判定は JWT の
-- app_metadata.role だけを見ること（lib/auth/permissions.ts の getRole() と
-- 同じ基準。user_metadata は本人が書き換えられるので判定に使わない）。
-- 古いマイグレーションには別の判定式を使っているものがあるが、引き写さない。
--
--   create policy "admins read ai model settings"
--     on public.ai_model_settings for select to authenticated
--     using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
--   grant select on public.ai_model_settings to authenticated;
