-- 「にちよさんに教える」を、1店舗1枚の自由メモから「トピックタイトル・本文」のノートの束にする。
-- トピックタイトルは「混む時間」「お支払い方法」のような、そのノートが何の話かを表す見出し。
--
-- 1. store_knowledge に、トピックタイトル・届け先（お客さん向け / 自分の相談向け）・並び順を足す。
--    1店舗で何枚でも持てる（これまでも行は複数持てたが、画面とAPIが1枚しか扱っていなかった）。
--    既存のメモは「その他」の1枚として引き継ぐ。
-- 2. 出店者ごとの「にちよさんに渡すもの」の設定 vendor_ai_settings を作る。
--    - お店の数字（閲覧数・売上など）を、自分の相談のにちよさんに使うか
--    - よく売れている商品を、お客さんへの案内に使うか（数字そのものは渡さない）
-- 3. ノートを届け先で絞って探す match_store_notes を作る。
--    あわせて既存の match_store_knowledge を直す（下記）。
--
-- 後方互換: 列はすべて既定値つきで足すだけ。旧コード（自由メモ1枚の画面）もそのまま動く。

-- ── 1. store_knowledge ──────────────────────────────────────────────

ALTER TABLE public.store_knowledge
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS for_visitors boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS for_vendor boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  -- トピックタイトルは一覧で1行に収まる長さ。本文はこれまでのAPIの上限（5000字）に合わせる
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_knowledge_title_length') THEN
    ALTER TABLE public.store_knowledge
      ADD CONSTRAINT store_knowledge_title_length CHECK (char_length(title) <= 60);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'store_knowledge_content_length') THEN
    ALTER TABLE public.store_knowledge
      ADD CONSTRAINT store_knowledge_content_length CHECK (char_length(content) <= 5000);
  END IF;
END;
$$;

-- 作成時（20260310004000）から Supabase 既定の全権限が付いたままになっている。
-- TRUNCATE は RLS を素通りして全店舗のノートを消せるので剥がす。
-- 匿名ユーザーが読み書きする用途は無い（お客さん向けのAIは service_role で読む）。
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.store_knowledge FROM anon, authenticated;
REVOKE ALL ON public.store_knowledge FROM anon;

-- これまでの自由メモには題が無いので、一覧で見分けられる名前を付ける
UPDATE public.store_knowledge SET title = 'お店のメモ' WHERE title = '';

COMMENT ON COLUMN public.store_knowledge.title IS 'トピックタイトル（例：混む時間、お支払い方法）。検索のときはトピックタイトルと本文をつなげてベクトルにする。';
COMMENT ON COLUMN public.store_knowledge.for_visitors IS 'お客さん向けのにちよさん（相談・店舗ページのチャット）に渡すか';
COMMENT ON COLUMN public.store_knowledge.for_vendor IS '出店者本人の使い方相談のにちよさんに渡すか';
COMMENT ON COLUMN public.store_knowledge.sort_order IS '一覧の並び順（小さいほど上）';

-- ── 2. vendor_ai_settings ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.vendor_ai_settings (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  use_stats_in_vendor_help boolean NOT NULL DEFAULT true,
  share_popular_with_visitors boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.vendor_ai_settings IS 'にちよさんにお店の情報をどこまで渡すかの、出店者ごとの設定。行が無ければ既定値として扱う。';
COMMENT ON COLUMN public.vendor_ai_settings.use_stats_in_vendor_help IS 'お店の数字（閲覧数・AIでの紹介回数・ハート・売れ筋）を、出店者本人の使い方相談に使うか';
COMMENT ON COLUMN public.vendor_ai_settings.share_popular_with_visitors IS 'よく売れている商品の名前を、お客さんへの案内に使うか（数や順位の数字は渡さない）';

ALTER TABLE public.vendor_ai_settings ENABLE ROW LEVEL SECURITY;

-- Supabase は新しいテーブルに TRUNCATE を含む全権限を付ける。TRUNCATE は RLS を素通りするので剥がし、
-- 出店者本人が自分の行を読み書きする分だけ付け直す。お客さん向けのAIは service_role で読む。
REVOKE ALL ON public.vendor_ai_settings FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.vendor_ai_settings TO authenticated;

DROP POLICY IF EXISTS "vendors read own ai settings" ON public.vendor_ai_settings;
CREATE POLICY "vendors read own ai settings"
  ON public.vendor_ai_settings FOR SELECT TO authenticated
  USING ((select auth.uid()) = vendor_id);

DROP POLICY IF EXISTS "vendors insert own ai settings" ON public.vendor_ai_settings;
CREATE POLICY "vendors insert own ai settings"
  ON public.vendor_ai_settings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = vendor_id);

DROP POLICY IF EXISTS "vendors update own ai settings" ON public.vendor_ai_settings;
CREATE POLICY "vendors update own ai settings"
  ON public.vendor_ai_settings FOR UPDATE TO authenticated
  USING ((select auth.uid()) = vendor_id)
  WITH CHECK ((select auth.uid()) = vendor_id);

-- ── 3. 検索関数 ────────────────────────────────────────────────────

-- 届け先（'visitor' / 'vendor'）で絞って、質問に近いノートを返す
CREATE OR REPLACE FUNCTION public.match_store_notes(
  query_embedding vector(1536),
  target_store_id uuid,
  audience        text,
  match_count     int   DEFAULT 3,
  match_threshold float DEFAULT 0.45
)
RETURNS TABLE (id uuid, title text, content text, similarity float)
LANGUAGE sql
STABLE
AS $$
  SELECT sk.id, sk.title, sk.content, 1 - (sk.embedding <=> query_embedding) AS similarity
  FROM public.store_knowledge sk
  WHERE sk.store_id = target_store_id
    AND sk.embedding IS NOT NULL
    AND CASE audience
          WHEN 'visitor' THEN sk.for_visitors
          WHEN 'vendor' THEN sk.for_vendor
          ELSE false
        END
    AND 1 - (sk.embedding <=> query_embedding) > match_threshold
  ORDER BY sk.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 呼ぶのはサーバーのAPI（service_role）だけ。RPC として誰でも叩けるようにはしない
REVOKE EXECUTE ON FUNCTION public.match_store_notes(vector, uuid, text, int, float) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_store_notes(vector, uuid, text, int, float) TO service_role;

-- 既存の match_store_knowledge（お客さん向けの相談 /api/grandma/ask が使う）を直す。
-- - 20260414081611 で store_id が uuid になったが、この関数は text の引数と比べていて
--   「uuid = text」の演算子が無いため、呼ぶたびに失敗していた（呼び出し側はエラーを無視していた）。
-- - お客さん向けなので、届け先が「お客さん」のノートだけを返す
--   （自分の相談だけに渡すノートが、お客さんに漏れないように）。
-- 新しいコードは match_store_notes を使う。この関数は旧コードのために残し、のちのリリースで消す。
CREATE OR REPLACE FUNCTION public.match_store_knowledge(
  query_embedding vector(1536),
  target_store_id text,
  match_count     int     DEFAULT 3,
  match_threshold float   DEFAULT 0.5
)
RETURNS TABLE (id uuid, store_id text, content text, similarity float)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
    SELECT
      sk.id,
      sk.store_id::text,
      sk.content,
      1 - (sk.embedding <=> query_embedding) AS similarity
    FROM public.store_knowledge sk
    WHERE sk.store_id::text = target_store_id
      AND sk.for_visitors
      AND sk.embedding IS NOT NULL
      AND 1 - (sk.embedding <=> query_embedding) > match_threshold
    ORDER BY sk.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

CREATE INDEX IF NOT EXISTS store_knowledge_store_sort_idx
  ON public.store_knowledge (store_id, sort_order, created_at);

-- 一覧で「にちよさんが探せるか（ベクトルを作れたか）」を出すための計算列。
-- ベクトルそのもの（1536個の数）を読まずに済ませる。PostgREST からは
-- select=has_embedding:store_knowledge_searchable で読める。
CREATE OR REPLACE FUNCTION public.store_knowledge_searchable(public.store_knowledge)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT $1.embedding IS NOT NULL;
$$;
