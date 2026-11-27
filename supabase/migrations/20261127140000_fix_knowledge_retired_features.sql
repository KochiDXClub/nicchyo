-- にちよさん（RAG）の知識データから、廃止した機能の説明を直す。
--
-- 20261127100000 で投入した知識に、すでに無い機能の案内が残っていた。
--   - バッグ（買い物リスト）: 廃止して、お気に入り（ハート）に統合済み。
--   - ことづて: 来訪者の投稿は無く、出店者が出す「近況」（/story）に置き換わっている（docs/FEATURES.md §⑤）。
-- にちよさんが無い機能を案内しないよう、今ある機能の説明に書き換える。
-- id は変えない（埋め込みの対応が変わらないように）。更新だけで、行の追加・削除はしない。
--
-- 適用後は、管理画面の埋め込み同期を実行して、にちよさんの検索に反映する。
update public.knowledge_entries
   set content = '日曜市をもっと楽しめるように、地図・検索・お気に入り・近況をまとめた体験型のWebプロジェクトです。',
       updated_at = now()
 where id = 'kb-003';

update public.knowledge_entries
   set content = 'マップでお店の場所を見て、検索で条件を絞り込めます。気になったお店はハートでお気に入りに入れておけます。出店者が出した近況も見られます。',
       updated_at = now()
 where id = 'kb-006';

update public.knowledge_entries
   set title = '近況の使い方',
       content = '近況は、出店者が当日の写真やお知らせを出す機能です。今日そのお店が何をしているかを、出店者自身の言葉で見られます。ハートで応援もできます。',
       updated_at = now()
 where id = 'kb-021';

update public.knowledge_entries
   set title = 'お気に入りの使い方',
       content = '気になったお店はハートを押すとお気に入りに入ります。後でまとめて見返せるので、歩きながら気になったお店を残しておくのにおすすめです。',
       updated_at = now()
 where id = 'kb-022';
