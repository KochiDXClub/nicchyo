-- =====================================================================
-- AIモデルの台帳（ai_models / ai_use_cases）
--
-- 目的:
--   1. 選べるAIモデルを、能力と価格つきで一覧として持つ
--   2. AIを使っている機能を一覧として持つ
--   3. どの機能にどのモデルを当てるかを運営が設定できるようにする
--
--   モデルの世代交代は数か月おきに起きるが、そのたびにコード変更 → PR →
--   デプロイを待つと、速度や品質の劣化をその週の日曜市に持ち込むことになる。
--
-- テーブルは2つ。
--
--   ai_models     … 選べるモデルの一覧。能力（トークン上限のパラメータ名、
--                   temperature を受け付けるか、推論の深さ）と価格を持つ
--   ai_use_cases  … AIを使っている機能の一覧。**どのモデルを使うかもこの行が持つ**
--
-- 「機能 → モデル」を別テーブルに切らないのは、機能1つにつき当たるモデルが
-- 常に1つで、分けても1対1の行が並ぶだけになるため。機能の行が「今どれを
-- 使っているか」を持つほうが、一覧を見たときに関係が読み取れる。
--
-- ai_prompts と違って版を積まない。
--   プロンプトは自由文なので「昨日の文面」を復元する手段が要るが、モデルは
--   ai_models から選ぶだけで、選択肢は画面にすべて見えている。戻すのは
--   選び直すのと同じ操作になる。誰がいつ変えたかは admin_audit_logs に残す。
--
-- ★ このテーブルの限界を明記しておく。
--   ai_use_cases に行を足しても、**新しいAI機能が生まれるわけではない**。
--   実際にモデルを使うのはコード側の呼び出し
--   （resolveAiModelFor("consult") など）で、行はそれに対応する台帳。
--   コードに無い key を足しても、どこからも参照されない行が増えるだけになる。
--   コード側の定義は lib/ai/models.ts。ズレは lib/ai/models.test.ts が止める。
-- =====================================================================

-- ─── 選べるモデルの一覧 ────────────────────────────────────────────────
create table if not exists ai_models (
  -- OpenAI API に渡す model 名。lib/ai/models.ts の AI_MODEL_DEFS と対応する
  id text primary key,
  -- 管理画面の表示名
  label text not null,
  -- 管理画面の説明。運営が「どれを選べばいいか」を判断できる言葉にする
  description text not null default '',

  -- ── 能力。ここを間違えると本番のリクエストが落ちる ──
  -- 出力上限のパラメータ名。GPT-5系は max_completion_tokens
  token_param text not null,
  -- temperature を送ってよいか。false のモデルには送らない
  supports_temperature boolean not null default true,
  -- 受け付ける reasoning_effort。空配列なら推論モデルではない。先頭が既定値
  reasoning_efforts text[] not null default '{}',
  -- 推論を有効にしたときに出力上限へ上乗せするトークン数。
  -- 推論トークンも出力上限を食うので、足さないと本文が空で返る
  reasoning_headroom_tokens integer not null default 0,

  -- ── 参考価格（$ / 1M token）。管理画面に出して運営が判断できるようにする ──
  price_input_per_mtok numeric(10, 4) not null default 0,
  price_output_per_mtok numeric(10, 4) not null default 0,

  -- 提供終了したモデルを、過去の記録を消さずに選べなくするためのフラグ
  is_selectable boolean not null default true,
  -- 管理画面での並び順
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_models_id_not_blank check (btrim(id) <> ''),
  constraint ai_models_id_length check (char_length(id) <= 100),
  constraint ai_models_label_not_blank check (btrim(label) <> ''),
  constraint ai_models_token_param_valid check (
    token_param in ('max_tokens', 'max_completion_tokens')
  ),
  constraint ai_models_headroom_non_negative check (reasoning_headroom_tokens >= 0),
  constraint ai_models_price_non_negative check (
    price_input_per_mtok >= 0 and price_output_per_mtok >= 0
  ),
  -- 受け付ける深さは決まった語彙のみ。ここを増やすときは
  -- lib/ai/models.ts の ReasoningEffort も直す（models.test.ts が突き合わせる）
  constraint ai_models_reasoning_efforts_valid check (
    reasoning_efforts <@ array['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']::text[]
  )
);

-- ─── AIを使っている機能の一覧と、当てるモデル ──────────────────────────
create table if not exists ai_use_cases (
  -- 機能のキー。lib/ai/models.ts の AiUseCase と対応する。
  -- ここに無い key をコードが要求したら、コード側の既定値に落ちる
  key text primary key,
  label text not null,
  description text not null default '',

  -- いま当てているモデル。null ならコード側の既定値を使う
  model_id text references ai_models (id) on delete set null,
  -- 推論の深さ。null ならモデルの既定値（reasoning_efforts の先頭）
  reasoning_effort text,

  -- コードから呼ばれなくなった機能を、記録を消さずに画面から隠すためのフラグ
  is_enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_use_cases_key_not_blank check (btrim(key) <> ''),
  constraint ai_use_cases_key_length check (char_length(key) <= 50),
  constraint ai_use_cases_label_not_blank check (btrim(label) <> '')
);

create index if not exists ai_use_cases_model_id_idx on ai_use_cases (model_id);

-- ─── 深さがそのモデルの受け付ける値かをDB側でも見る ────────────────────
-- アプリ側（validateAiModelChoice）でも見ているが、テーブルを直接触られた
-- ときに「そのモデルでは使えない深さ」が残ると、API が 400 で落ち続ける
-- 状態を無言で作れてしまう。外部キーでは表現できないのでトリガで見る。
create or replace function public.ai_use_cases_validate_model()
returns trigger
language plpgsql
-- security definer にはしない。書き込むのは RLS をバイパスする service role
-- だけで、権限を昇格させる理由がない
set search_path = public
as $$
declare
  allowed text[];
  selectable boolean;
begin
  new.updated_at := now();

  if new.model_id is null then
    -- モデル未設定ならコード側の既定値に落ちる。深さだけ残っても意味がない
    new.reasoning_effort := null;
    return new;
  end if;

  select m.reasoning_efforts, m.is_selectable
    into allowed, selectable
    from public.ai_models m
   where m.id = new.model_id;

  if not found then
    raise exception 'ai_models に無いモデルです: %', new.model_id
      using errcode = '23503';
  end if;

  if not selectable then
    raise exception '選択できないモデルです（提供終了）: %', new.model_id
      using errcode = '23514';
  end if;

  if new.reasoning_effort is not null
     and not (new.reasoning_effort = any (allowed)) then
    raise exception '% はこのモデルが受け付けない深さです: %', new.reasoning_effort, new.model_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.ai_use_cases_validate_model() from public, anon, authenticated;

drop trigger if exists ai_use_cases_validate_model on ai_use_cases;
create trigger ai_use_cases_validate_model
  before insert or update on ai_use_cases
  for each row execute function public.ai_use_cases_validate_model();

create or replace function public.ai_models_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.ai_models_touch_updated_at() from public, anon, authenticated;

drop trigger if exists ai_models_touch_updated_at on ai_models;
create trigger ai_models_touch_updated_at
  before insert or update on ai_models
  for each row execute function public.ai_models_touch_updated_at();

-- ─── 初期データ ────────────────────────────────────────────────────────
-- ai_prompts では初期行を入れなかったが（プロンプト文をSQLに焼くとコード側と
-- 二重管理になるため）、こちらは台帳そのものなので行が無いと画面に何も出ない。
-- コード側の定義（lib/ai/models.ts）と同じ内容を入れ、ズレは
-- lib/ai/models.test.ts の突き合わせテストで止める。
--
-- モデルを増やすときは「マイグレーション追加」と「AI_MODEL_DEFS 追加」の
-- 両方が要る。テストが落ちるので片方だけになることはない。
insert into ai_models (
  id, label, description, token_param, supports_temperature,
  reasoning_efforts, reasoning_headroom_tokens,
  price_input_per_mtok, price_output_per_mtok, sort_order
) values
  (
    'gpt-4o-mini',
    'GPT-4o mini（現行）',
    '長く使ってきた既定のモデル。速度・安定性ともに実績がある。ChatGPT と Azure では提供が終了しており、APIもいずれ終わる見込み。',
    'max_tokens', true, '{}', 0, 0.15, 0.60, 10
  ),
  (
    'gpt-5.4-nano',
    'GPT-5.4 nano（推奨）',
    '会話向けの軽量モデル。2026-07 の比較で最速だった。相談・店舗チャット・意図抽出のような、速さが体験を決める場面向け。',
    'max_completion_tokens', false, '{minimal,low,medium,high}', 4000, 0.20, 1.25, 20
  ),
  (
    'gpt-5.4-mini',
    'GPT-5.4 mini',
    'nano より賢いが約4倍高く、体感で2倍遅い。回り方プランのように、実際に順序を考える必要がある場面向け。',
    'max_completion_tokens', false, '{minimal,low,medium,high}', 6000, 0.75, 4.50, 30
  ),
  (
    'gpt-5-nano',
    'GPT-5 nano（最安）',
    '候補の中で最も安い。5.4 nano より前の世代なので品質は落ちる。コストを最優先する場面向け。',
    'max_completion_tokens', false, '{minimal,low,medium,high}', 4000, 0.05, 0.40, 40
  ),
  (
    'gpt-5.6-luna',
    'GPT-5.6 Luna',
    '5.6 世代の軽量モデル。価格は 5.4 nano とほぼ同じ。推論を切れば速いが、既定のままだと考えてから答えるぶん待ちが伸びる。',
    'max_completion_tokens', true, '{none,low,medium,high,xhigh,max}', 6000, 0.20, 1.20, 50
  )
on conflict (id) do nothing;

-- 機能側は model_id を入れずに作る。
-- null のあいだはコード側の既定値（AI_USE_CASE_DEFS.defaultModelId）が使われる。
-- ここでモデル名まで焼くと、コード側の既定値と食い違ったときに
-- どちらが効いているのか読めなくなる。
insert into ai_use_cases (key, label, description, sort_order) values
  (
    'consult',
    'AI相談（にちよさん）',
    '相談ページとマップのミニチャット。土佐弁の会話を1文字ずつ流しながら返すので、待ち時間がそのまま体験に出る。',
    10
  ),
  (
    'shopChat',
    '店舗ページのチャット',
    '店舗詳細ページの短い質問応答。280文字程度の短い返事を速く返す。',
    20
  ),
  (
    'itinerary',
    '回り方プラン',
    '時間と興味から順路を組み立てる。実際に順序を考える処理なので、ここだけは賢いモデルが効く可能性がある。',
    30
  ),
  (
    'mapAgent',
    'マップAIアシスタント',
    '質問から意図を読み取ってJSONで返す。分類・抽出に近い処理。',
    40
  )
on conflict (key) do nothing;

-- ─── 権限 ──────────────────────────────────────────────────────────────
alter table ai_models enable row level security;
alter table ai_use_cases enable row level security;

-- 読み書きはすべてサーバー側（service role）から行う。service role は RLS を
-- バイパスするので、ブラウザ由来のロールには一切権限を渡さない。
--
-- Supabase は public スキーマの新規テーブルに anon / authenticated への権限を
-- 既定で付ける（このリポジトリに alter default privileges での一括剥奪はない）。
-- RLS だけに頼らず GRANT も明示的に剥がす。
-- 先例: 20260906120000_create_ai_prompts.sql
revoke all on public.ai_models from anon, authenticated;
revoke all on public.ai_use_cases from anon, authenticated;

-- ポリシーは作らない。
--
-- ブラウザから直接読ませる必要が出た場合でも、管理者判定は JWT の
-- app_metadata.role だけを見ること（lib/auth/permissions.ts の getRole() と
-- 同じ基準。user_metadata は本人が書き換えられるので判定に使わない）。
-- 古いマイグレーションには別の判定式を使っているものがあるが、引き写さない。
--
--   create policy "admins read ai models"
--     on public.ai_models for select to authenticated
--     using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
--   grant select on public.ai_models to authenticated;
