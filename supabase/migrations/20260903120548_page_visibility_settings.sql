-- =====================================================================
-- ページ公開設定（page_visibility）
--
-- 1. system_settings の非機密キー（public / page_visibility）を
--    全ロール（anon / authenticated）が SELECT できるポリシーを追加する。
--    proxy.ts がメンテナンス判定・ページ公開判定のために anon キーで読むため。
--    書き込みは従来どおり admin のみ。
-- 2. page_visibility の初期行（空設定）を投入する。
-- =====================================================================

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'system_settings'
      and policyname = 'anyone reads non-sensitive system settings'
  ) then
    create policy "anyone reads non-sensitive system settings"
    on system_settings
    for select
    using (key in ('public', 'page_visibility'));
  end if;
end $$;

insert into system_settings (key, value)
values ('page_visibility', jsonb_build_object('pages', '{}'::jsonb))
on conflict (key) do nothing;

-- 目的: 管理画面「ページ公開設定」でロール別に 公開 / 限定公開 / 非公開 を切り替えられるようにする。
--       proxy.ts が anon キーで設定を読めるよう、非機密キーに限定した SELECT ポリシーを追加した。
