-- AI相談ログから質問文とIPアドレスを落とす。
--
-- 経緯（#629）:
-- ai_consult_logs.question_text と ip_address は書き込まれるだけで、
-- コード上どこからも読まれていなかった。実際に読まれているのは
-- intent_category / keywords / location_type / is_recommendation / consulted_at のみ。
--   - 管理画面の解析      : intent_category, consulted_at
--   - 出店者向けの解析    : intent_category, keywords, location_type, is_recommendation
--   - レート制限          : enforceRateLimit が担当しており、この表は参照しない
--
-- 読み手のないデータを保存期間つきで持つより、最初から持たない方が確実なので列ごと落とす。
-- 会話の継続はクライアント側の状態で成立しているため、機能への影響はない。

alter table public.ai_consult_logs drop column if exists question_text;
alter table public.ai_consult_logs drop column if exists ip_address;

comment on table public.ai_consult_logs is
  'AI相談の利用記録。相談内容そのもの（質問文）とIPアドレスは保存しない。'
  ' 解析に使う意図分類・キーワード・場所種別と、件数の集計に必要な時刻だけを持つ。';
