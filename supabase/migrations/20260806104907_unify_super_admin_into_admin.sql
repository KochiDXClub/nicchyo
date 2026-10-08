-- admin / super_admin ロールを admin に統合する
-- アプリ側のロール階層から super_admin を廃止したため、既存データを移行する

-- vendors.role の super_admin を admin に統合
UPDATE public.vendors SET role = 'admin' WHERE role = 'super_admin';

-- auth.users の app_metadata.role も同様に統合
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', 'admin')
WHERE raw_app_meta_data ->> 'role' = 'super_admin';
