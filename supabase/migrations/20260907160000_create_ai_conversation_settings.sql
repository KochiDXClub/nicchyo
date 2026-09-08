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
-- テーブルが持つのは「運営が決めた値」と「受け付ける範囲」だけ。
-- 見出し・説明・並び順はコード側（lib/ai/conversationSettings.ts）が持つ。
-- 両方に置くと、画面の表示だけDBを見て検証はコードを見る、という
-- 食い違いが起きる。DBに置いた範囲は、APIを通らない書き込み
-- （SQLエディタでの手直しなど）に効く最後の砦として持たせている。
--
-- ★ このテーブルの限界を明記しておく。
--   行を足しても新しい設定は生まれない。実際に値を読むのはコード側
--   （fetchAiConversationSettings() → ask/route.ts）で、行はそれに
--   対応する台帳。コードに無い key の行は、どこからも参照されない行が
--   増えるだけになる。そのため insert は塞いである（下の revoke と、
--   型の Insert: never）。
--   ズレは lib/ai/conversationSettings.test.ts が止める。
-- =====================================================================

-- ─── 設定の一覧 ────────────────────────────────────────────────────────
create table if not exists ai_conversation_settings (
  -- 設定のキー。lib/ai/conversationSettings.ts の定義と対応する
  key text primary key,
  -- 運営が決めた値
  value integer not null,
  -- 受け付ける範囲。キーごとに違う（値を間違えたときの被害が違うため）
  min_value integer not null,
  max_value integer not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),

  constraint ai_conversation_settings_bounds_sane check (min_value <= max_value),
  -- 範囲外の値を保存できないようにする。
  -- 読み取り側（normalizeAiConversationSettings）も同じ範囲で挟むが、
  -- APIを介さない書き込みはここでしか止まらない
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
-- 上下限はマイグレーションを正本にする（do update で直せる）。
-- 値は「発話数, 下限, 上限」の順。lib/ai/conversationSettings.ts と揃える
insert into ai_conversation_settings (key, value, min_value, max_value)
values
  -- 1回の返答の発話数。2以上にすると1秒ずつ間をあけて別の吹き出しが出るため、
  -- 同じキャラでも掛け合いのように見える
  ('consult.max_turns', 1, 1, 3),
  -- 返答の長さ。300 未満にすると、非ストリーミング経路のJSONが途中で切れる
  ('consult.max_output_tokens', 500, 300, 1200),
  -- AIに渡す直近の会話の件数。多いほど古いやり取りの言い回しを真似しやすい
  ('consult.history_limit', 6, 0, 12)
on conflict (key) do update set
  min_value = excluded.min_value,
  max_value = excluded.max_value,
  -- 上下限を狭める向きに直すと、既存の value が新しい範囲から外れて
  -- CHECK 制約に引っかかり、**このマイグレーション自体が落ちる**。
  -- しかも範囲外の値は本番にしか無いので、ローカルやCIでは再現しない。
  -- 運営が決めた値は尊重しつつ、新しい範囲に丸めておく
  value = least(
    greatest(ai_conversation_settings.value, excluded.min_value),
    excluded.max_value
  );

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

-- 行はマイグレーションでしか作らない。APIに許すのは値の更新だけ。
-- service role は RLS をバイパスするが GRANT はバイパスしないので、ここで効く。
-- 型（types/database.extensions.ts の Insert: never）だけでは、型を無視した
-- 呼び出しやSQLの直叩きは止まらない。
-- マイグレーションの実行者は postgres なので、この revoke の影響を受けない
revoke insert, delete, truncate on public.ai_conversation_settings from service_role;

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
