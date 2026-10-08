-- Claude Haiku 5.5 を選択肢に加える（提供元の列 provider を足す）
--
-- これまで ai_models は OpenAI のモデルだけだった。Anthropic のモデルも
-- 管理画面で機能ごとに選べるようにするため、提供元を表す provider 列を足す。
-- 既存の行は openai のまま。呼び出し先の切り替えは lib/ai/anthropicAdapter.ts が行う。
--
-- Haiku 5.5（claude-haiku-5-5）: 入力 $0.10 / 出力 $0.50（100K トークンまでのプロンプト）。
--   - 出力上限は max_tokens
--   - temperature は既定値以外を 400 で拒否するので送らない（supports_temperature = false）
--   - 推論の深さは台帳から選ばせない。アダプタが「考え込まない」に固定する
--     （reasoning_efforts は空）
--   - ANTHROPIC_API_KEY が無い・拒否されたときは、コード側の既定モデルで答え続ける
--
-- 形は 20260907113000_create_ai_model_registry.sql の初期データと同じ
-- values タプルで書く（provider は末尾の列）。lib/ai/models.test.ts が
-- 「最後に投入されたタプル」をコード側の AI_MODEL_DEFS と突き合わせる。

alter table ai_models
  add column if not exists provider text not null default 'openai';

alter table ai_models drop constraint if exists ai_models_provider_valid;
alter table ai_models
  add constraint ai_models_provider_valid check (provider in ('openai', 'anthropic'));

-- Anthropic のモデルは max_tokens でしか動かず、推論の深さを台帳から指定する経路も無い。
-- 合わない組み合わせは、その機能の全リクエストが落ち続ける
alter table ai_models drop constraint if exists ai_models_anthropic_capabilities;
alter table ai_models
  add constraint ai_models_anthropic_capabilities check (
    provider <> 'anthropic'
    or (token_param = 'max_tokens' and cardinality(reasoning_efforts) = 0)
  );

insert into ai_models (
  id, label, description, token_param, supports_temperature,
  reasoning_efforts, reasoning_headroom_tokens,
  price_input_per_mtok, price_output_per_mtok, sort_order, provider
) values
  (
    'claude-haiku-5-5',
    'Claude Haiku 5.5',
    'Anthropic の軽量モデル（ANTHROPIC_API_KEY が必要）。価格は GPT-6 Luna と同じ水準。temperature は送らず、考え込まずに答える設定で呼ぶ。キーが無い・拒否されたときは既定のモデルに切り替わる。',
    'max_tokens', false, '{}', 0, 0.10, 0.50, 70, 'anthropic'
  )
-- is_selectable は運営の判断で落とすことがあるので触らない（初期データと同じ方針）
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  token_param = excluded.token_param,
  supports_temperature = excluded.supports_temperature,
  reasoning_efforts = excluded.reasoning_efforts,
  reasoning_headroom_tokens = excluded.reasoning_headroom_tokens,
  price_input_per_mtok = excluded.price_input_per_mtok,
  price_output_per_mtok = excluded.price_output_per_mtok,
  sort_order = excluded.sort_order,
  provider = excluded.provider,
  updated_by = null;
