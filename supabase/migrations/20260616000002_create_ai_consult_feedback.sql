-- AIばあちゃんへの回答フィードバック（👍/👎）
create table if not exists public.ai_consult_feedback (
  id           uuid        primary key default gen_random_uuid(),
  consult_id   uuid        not null,
  turn_index   int         not null,
  rating       smallint    not null,        -- 1 = 👍, -1 = 👎
  comment      text,                        -- 👎 のときのみ任意入力
  question_text text,
  turn_text    text,
  created_at   timestamptz not null default now()
);

alter table public.ai_consult_feedback enable row level security;

-- 書き込みはサービスロール経由（APIから）のみ
-- 読み取りはサービスロールのみ（管理者分析用）

create index if not exists idx_ai_consult_feedback_created_at on public.ai_consult_feedback (created_at);
create index if not exists idx_ai_consult_feedback_rating     on public.ai_consult_feedback (rating);
create index if not exists idx_ai_consult_feedback_consult_id on public.ai_consult_feedback (consult_id);
