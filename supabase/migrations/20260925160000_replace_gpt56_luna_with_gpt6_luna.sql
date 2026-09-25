-- GPT-5.6 Luna を選択肢から外し、後継の GPT-6 Luna に置き換える
--
-- GPT-6 Luna は 2026-09-22 公開。価格は $0.10 / $0.50（5.6 Luna は $0.20 / $1.20）。
-- 受け付ける深さは 5.6 Luna と同じ none / low / medium / high / xhigh / max。
-- API 側の既定は medium なので、先頭（= 機能側で未指定のときの既定）を none にして
-- 推論を明示的に切る。
--
-- temperature は未実測。「推論なしなら受け付ける」「既定値の 1 以外は受け付けない」
-- の両方の情報があるため、送らない側（false）に倒す。
--
-- 形は 20260907113000_create_ai_model_registry.sql の初期データと同じ
-- values タプルで書く。lib/ai/models.test.ts が「最後に投入されたタプル」を
-- コード側の AI_MODEL_DEFS と突き合わせる。

-- ① 後継を先に入れる。② で機能の付け替え先になるため
--    （ai_use_cases_validate_model が「台帳にある・選択できる」ことを見る）
insert into ai_models (
  id, label, description, token_param, supports_temperature,
  reasoning_efforts, reasoning_headroom_tokens,
  price_input_per_mtok, price_output_per_mtok, sort_order
) values
  (
    'gpt-6-luna',
    'GPT-6 Luna',
    '6 世代の軽量モデル（5.6 Luna の後継）。候補の中で 5 nano の次に安く、推論なしなら最初の文字が出るのが速い。深さを上げると考えてから答えるぶん待ちが伸びる。',
    'max_completion_tokens', false, '{none,low,medium,high,xhigh,max}', 6000, 0.10, 0.50, 50
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

-- ② 5.6 Luna を使っていた機能は 6 Luna に付け替える。
--    深さは両者で同じ語彙なのでそのまま引き継げる。
--    ③ で選べなくすると、トリガ ai_models_sync_use_cases が機能をモデル未設定
--    （= コード側の既定モデル）に戻してしまうため、その前に付け替える
update ai_use_cases
   set model_id = successor.id
  from ai_models successor
 where ai_use_cases.model_id = 'gpt-5.6-luna'
   and successor.id = 'gpt-6-luna';

-- ③ 5.6 Luna は選択肢から外す。行は消さない（過去の記録の参照先を残すため。
--    is_selectable はそのための列）
update ai_models
   set is_selectable = false,
       updated_by = null
 where id = 'gpt-5.6-luna';
