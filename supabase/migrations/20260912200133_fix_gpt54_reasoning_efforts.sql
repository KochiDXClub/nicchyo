-- GPT-5.4 系（nano / mini）の能力の訂正
--
-- 台帳では reasoning_efforts を '{minimal,low,medium,high}' としていたが、
-- 実際の API は 5.4 系で `minimal` を受け付けない
-- （400 unsupported_value: Supported values are: 'none', 'low', 'medium', 'high', and 'xhigh'。
-- 2026-09-12 に実測）。先頭が既定の深さになるので、モデルを選んだだけで
-- 全リクエストが 400 になっていた。
--
-- あわせて temperature は 0.7 で 200 が返ることを確認したので、送る側に倒す。
--
-- 形は 20260907113000_create_ai_model_registry.sql の初期データと同じ
-- values タプルで書く。lib/ai/models.test.ts が「最後に投入されたタプル」を
-- コード側の AI_MODEL_DEFS と突き合わせるため、ここで id を引用符つきで書くのは
-- タプルの中だけにすること。
--
-- reasoning_efforts が変わると、トリガ ai_models_sync_use_cases が
-- 受け付けなくなった深さ（minimal）を指定していた機能の深さを未指定に戻す。

insert into ai_models (
  id, label, description, token_param, supports_temperature,
  reasoning_efforts, reasoning_headroom_tokens,
  price_input_per_mtok, price_output_per_mtok, sort_order
) values
  (
    'gpt-5.4-nano',
    'GPT-5.4 nano（推奨）',
    '会話向けの軽量モデル。2026-07 の比較で最速だった。相談・店舗チャット・意図抽出のような、速さが体験を決める場面向け。',
    'max_completion_tokens', true, '{none,low,medium,high,xhigh}', 4000, 0.20, 1.25, 20
  ),
  (
    'gpt-5.4-mini',
    'GPT-5.4 mini',
    'nano より賢いが約4倍高く、体感で2倍遅い。回り方プランのように、実際に順序を考える必要がある場面向け。',
    'max_completion_tokens', true, '{none,low,medium,high,xhigh}', 6000, 0.75, 4.50, 30
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
  updated_by = null;
