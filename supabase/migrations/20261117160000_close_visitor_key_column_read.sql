-- ai_consult_logs / content_reactions の visitor_key を、ログインユーザーが読めないようにする（#1069 PR-A）
--
-- 背景:
-- 出店者（認証ユーザーで、そのお店の 'analytics' 権限を持つ人）は、RLS ポリシー
--   "vendors can read own store logs"                 （ai_consult_logs）
--   "vendors can read reactions on own contents"      （content_reactions）
-- （どちらも 20261003100100_rls_use_shop_members.sql）で、自分のお店に関わる行を読める。
-- RLS は行単位なので、行が読めれば visitor_key（来訪者を識別する匿名キー）まで読めてしまう。
-- 出店者の画面は visitor_key を使っておらず、読める必要がない。
--
-- 方針: 列単位の権限（column-level privilege）で visitor_key だけを塞ぐ。
-- Postgres は「表全体の SELECT を持ったまま 1 列だけ剥がす」ことができないので、
--   1. 表全体の SELECT を anon / authenticated から剥がす（列単位の権限もまとめて消える）
--   2. visitor_key 以外の列にだけ SELECT を付け直す（authenticated のみ。anon は読めないまま）
-- の 2 段階にする。RLS ポリシーはそのまま（読める行の範囲は変えない）。
--
-- 影響しないもの:
--   - service_role: 権限もRLSも受けない。visitor_key の書き込み・参照はすべてここ経由。
--       ai_consult_logs   app/api/grandma/ask/handler.ts（INSERT）
--       content_reactions app/api/stories/[id]/reactions/route.ts, app/api/reactions/counts/route.ts
--   - INSERT / DELETE などの権限（20260911220100 の整理はそのまま。ここでは SELECT だけを触る）
--   - 出店者の画面: analyticsService.ts / helpChatStats.server.ts は
--       content_reactions → select("id") + count
--       ai_consult_logs   → select("intent_category, keywords, is_recommendation") / select("keywords") / select("id") + count
--     のように、付け直す列だけを読んでいる。
--   - RLS ポリシーが参照する列（store_id / vendor_content_id）は付け直す側に含めている。
--
-- 注意（この変更で意図して起きること）:
--   - authenticated が select("*") すると permission denied になる。列を明示すること。
--   - この 2 表に今後 ADD COLUMN しても、その列は authenticated に自動では SELECT が付かない。
--     出店者の画面で読ませたい列を足すときは、そのマイグレーションで
--       grant select (<新しい列>) on public.<表> to authenticated;
--     も一緒に書くこと。visitor_key のような識別子は付けない。
--
-- 付け直す列（現在のスキーマ。types/database.types.ts と各マイグレーションで確認）:
--   ai_consult_logs   id, store_id, intent_category, keywords, location_type,
--                     is_recommendation, consulted_at, created_at   （visitor_key を除く 8 列）
--   content_reactions id, vendor_content_id, created_at              （visitor_key を除く 3 列）
--
-- 破壊的な文: REVOKE を含む（authenticated / anon の SELECT を狭める。意図した変更）。
-- 2 回流しても同じ結果になる（revoke / grant はどちらも冪等）。

-- ── ai_consult_logs ─────────────────────────────────────────────────────
-- anon の SELECT は 20260911220100 で剥がし済みだが、ここでも明示して両表をそろえる
revoke select on public.ai_consult_logs from anon, authenticated;
grant select (
  id,
  store_id,
  intent_category,
  keywords,
  location_type,
  is_recommendation,
  consulted_at,
  created_at
) on public.ai_consult_logs to authenticated;

-- ── content_reactions ───────────────────────────────────────────────────
revoke select on public.content_reactions from anon, authenticated;
grant select (
  id,
  vendor_content_id,
  created_at
) on public.content_reactions to authenticated;
