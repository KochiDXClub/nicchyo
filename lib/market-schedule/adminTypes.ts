export type PlaceRow = { id: string; store_number: number; official_number: number | null; branch_number: number | null; district: string | null; place_name: string | null; latitude?: number | null; longitude?: number | null };
export type VendorRow = { id: string; shop_name: string | null; market_place_id?: string | null };
export type MembershipRow = { id: string; location_id: string; vendor_id: string; vendor_number: number };
export type PeriodRow = { id: string; membership_id: string; starts_on: string; ends_on: string | null };
export type RuleRow = { id: string; membership_id: string; period_id: string; cadence: "weekly" | "fortnightly" | "monthly"; starts_on: string; ends_on: string | null; anchor_on: string | null; month_weeks: number[] | null; voided_at?: string | null };
export type OverrideRow = { location_id: string; market_date: string; membership_id: string | null; updated_at: string; revision: number; is_cleared: boolean };
export type ScheduleAdminData = { places: PlaceRow[]; vendors: VendorRow[]; memberships: MembershipRow[]; periods: PeriodRow[]; rules: RuleRow[]; overrides: OverrideRow[]; marketDays?: { market_date: string; status: string }[]; legacyAssignments?: { id: string; vendor_id: string; location_id: string; market_date: string }[] };
