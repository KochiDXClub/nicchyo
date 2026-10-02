-- 運営・市役所から出店者へのお知らせ（vendor_notices）と、出店者の「確認しました」（vendor_notice_reads）。
--
-- 出店者連絡（vendor_inquiries）は出店者から運営・市役所へ送る窓口で、逆向きの受け皿がなかった。
-- 一斉メールは見ない出店者も多いので、毎週開く出店者ページで受け取れるようにする。
--
-- 用件・状態の決まりが違うため vendor_inquiries には相乗りしない（お知らせは全出店者あて・返信なし）。
-- 市役所ロールはまだ無い（#478）ので、運営が差出人（市役所／運営）を選んで代わりに出す。
--
-- 直接のアクセスは許可しない。読み書きはすべてサーバーの service_role 経由で、
-- 運営か出店者かの判定は API 層（getUser）で行う（content_views と同じ形）。
-- 出店者ごとの確認の有無を他の出店者が読めないようにするため。

CREATE TABLE IF NOT EXISTS public.vendor_notices (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender      text        NOT NULL CHECK (sender IN ('city', 'operator')),
  title       text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  body        text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  important   boolean     NOT NULL DEFAULT false,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendor_notices_created_at_idx ON public.vendor_notices (created_at DESC);

CREATE TABLE IF NOT EXISTS public.vendor_notice_reads (
  notice_id   uuid        NOT NULL REFERENCES public.vendor_notices(id) ON DELETE CASCADE,
  vendor_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notice_id, vendor_id)
);

-- 出店者ごとに「どれを確認したか」を引く
CREATE INDEX IF NOT EXISTS vendor_notice_reads_vendor_idx ON public.vendor_notice_reads (vendor_id);

ALTER TABLE public.vendor_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_notice_reads ENABLE ROW LEVEL SECURITY;

-- Supabase は新しいテーブルに anon / authenticated の全権限（TRUNCATE を含む）を付ける。
-- ポリシーが無くても TRUNCATE は RLS を素通りするので、すべて剥がす。
REVOKE ALL ON public.vendor_notices FROM anon, authenticated;
REVOKE ALL ON public.vendor_notice_reads FROM anon, authenticated;

COMMENT ON TABLE public.vendor_notices IS
  '運営・市役所から全出店者へのお知らせ。sender は差出人の表示（市役所ロール #478 までは運営が代わりに出す）。読み書きは service_role のみ。';
COMMENT ON TABLE public.vendor_notice_reads IS
  '出店者がお知らせを「確認しました」とした記録。1お知らせ1出店者1行。読み書きは service_role のみ。';

-- お知らせごとの確認した出店者の数を DB 側で数える（get_view_counts と同じ形）。
-- 行をそのまま読むと PostgREST の最大行数で切れるため。
CREATE OR REPLACE FUNCTION public.get_vendor_notice_read_counts(notice_ids uuid[])
RETURNS TABLE (notice_id uuid, cnt bigint)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT r.notice_id, count(*)::bigint AS cnt
  FROM public.vendor_notice_reads r
  WHERE r.notice_id = ANY(notice_ids)
  GROUP BY r.notice_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_vendor_notice_read_counts(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vendor_notice_read_counts(uuid[]) TO service_role;
