-- PR #433 レビュー (#pullrequestreview-4882449898) 対応
--
-- ブロッカー1: authenticated への列制限漏れ
--   20260807112200_create_vendor_owner_profiles.sql は
--     revoke select on public.vendors from anon;
--   のみを実行しており、authenticated には列制限をかけていなかった。
--   本番の information_schema.column_privileges を確認したところ、
--   migrations に記録のない広い GRANT が authenticated に対して残っており、
--   ログイン済みの一般ユーザー（管理者である必要なし）が
--     GET /rest/v1/vendors?select=owner_name,role,must_change_password
--   のように is_public を無視して owner_name（当時） / role /
--   must_change_password を直接読める状態だった。
--   authenticated から実際に vendors を参照しているクライアントコードは
--   すべて公開画面と同じ列（+ closed_dates）しか使っていないため、
--   anon と同じ列制限を authenticated にも適用する。
--
-- ブロッカー2: vendors.role の自己昇格（PR #431 と同一の穴）
--   "vendor update self" ポリシー（20260224011000_enable_vendors_rls.sql）は
--     using (auth.uid() = id) with check (auth.uid() = id)
--   と行単位の制限しかなく、role / must_change_password の列制限がない。
--   本PRで vendor_owner_profiles の管理者ポリシーが vendors.role = 'admin' を
--   信頼起点にしているため、この穴が残ると出店者が自分の role を admin に
--   書き換えるだけで非公開設定の出店者氏名まで読めてしまう。
--   PR #431（fix/rls-prevent-vendor-role-escalation）と同内容のトリガをここにも
--   適用する。PR #431 が先にマージされた場合も CREATE OR REPLACE /
--   DROP TRIGGER IF EXISTS のため冪等で害はない。

-- ── authenticated の列アクセスを anon と同じ範囲に絞る ──────────────────
revoke select on public.vendors from authenticated;

grant select (
  id,
  shop_name,
  strength,
  style,
  style_tags,
  category_id,
  main_products,
  main_product_prices,
  payment_methods,
  rain_policy,
  schedule,
  shop_image_url,
  sns_instagram,
  sns_x,
  sns_hp,
  business_hours_start,
  business_hours_end,
  closed_dates,
  created_at,
  updated_at
) on public.vendors to authenticated;

-- ── vendors.role / must_change_password の自己変更を防ぐ（PR #431 と同一） ──
create or replace function public.prevent_vendor_privilege_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- サーバー側 API（service_role）と DB 管理者は従来どおり変更できる
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- role / must_change_password は入力値を信用せず、既定値に強制する
    new.role := 'vendor';
    new.must_change_password := true;
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'vendors.role は変更できません'
      using errcode = '42501';
  end if;

  if new.must_change_password is distinct from old.must_change_password then
    raise exception 'vendors.must_change_password は変更できません'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_vendor_privilege_escalation on public.vendors;

create trigger prevent_vendor_privilege_escalation
  before insert or update on public.vendors
  for each row
  execute function public.prevent_vendor_privilege_escalation();

-- 目的: (1) vendors への authenticated アクセスを anon と同じ公開列だけに絞り、
--       (2) 出店者が自分の vendors 行の INSERT/UPDATE を通じて role /
--           must_change_password を書き換えられる経路を塞ぐ。
