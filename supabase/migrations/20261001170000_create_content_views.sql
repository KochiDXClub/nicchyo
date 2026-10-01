-- 近況（ストーリー）を「見た人」の数を数える。
-- 出店者が、出した近況がどれくらい見られているかを知るため。
--
-- ハート（content_reactions）と同じく、匿名の visitor_key 単位で1投稿につき1回だけ数える
-- （同じ人が何度開いても1人）。乱用はアプリ層の same-origin・レート制限と unique 制約で抑える。
--
-- 直接の匿名アクセスは許可しない。読み書きはすべてサーバーの service_role 経由で行う。
-- これにより、公開 anon キーで数を水増ししたり、誰が何を見たかを読んだりできないようにする。

CREATE TABLE IF NOT EXISTS public.content_views (
  id                bigserial   PRIMARY KEY,
  vendor_content_id uuid        NOT NULL REFERENCES public.vendor_contents(id) ON DELETE CASCADE,
  visitor_key       text        NOT NULL CHECK (char_length(visitor_key) BETWEEN 1 AND 128),
  viewed_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_content_id, visitor_key)
);

CREATE INDEX IF NOT EXISTS content_views_content_idx ON public.content_views (vendor_content_id);

ALTER TABLE public.content_views ENABLE ROW LEVEL SECURITY;

-- Supabase は新しいテーブルに anon / authenticated の全権限（TRUNCATE を含む）を付ける。
-- ポリシーが無くても TRUNCATE は RLS を素通りするので、すべて剥がす。
REVOKE ALL ON public.content_views FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.content_views_id_seq FROM anon, authenticated;

COMMENT ON TABLE public.content_views IS
  '近況（vendor_contents）を見た人。visitor_key 単位で1投稿1行。読み書きは service_role のみ。';

-- 指定した投稿ごとの「見た人」の数を DB 側で数える（get_reaction_counts と同じ形）
CREATE OR REPLACE FUNCTION public.get_view_counts(content_ids uuid[])
RETURNS TABLE (vendor_content_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT cv.vendor_content_id, count(*)::bigint AS cnt
  FROM public.content_views cv
  WHERE cv.vendor_content_id = ANY(content_ids)
  GROUP BY cv.vendor_content_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_view_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_view_counts(uuid[]) TO service_role;
