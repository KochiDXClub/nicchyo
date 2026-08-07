-- anon ロールにマップ表示に必要なテーブルの SELECT 権限を付与する
-- RLS ポリシー（public read）だけでは anon はアクセスできないため明示的に GRANT が必要

GRANT SELECT ON public.vendors TO anon;
GRANT SELECT ON public.market_locations TO anon;
GRANT SELECT ON public.location_assignments TO anon;
GRANT SELECT ON public.categories TO anon;
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.vendor_contents TO anon;
