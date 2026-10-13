// 出店者メンバーの操作権限（権限キー・ひな形・表示名）の単一の情報源。
//
// DB 側の対応:
//   - shop_members.permissions の check 制約（supabase/migrations/20261003100000_create_shop_members.sql）
//   - RLS / API は has_shop_permission(店舗, 権限キー) で判定する
// キーを増減するときは、この配列と上の check 制約を一緒に直す。

export const SHOP_PERMISSION_KEYS = [
  "store_edit",
  "post",
  "ai_notes",
  "inquiries",
  "analytics",
  "audit_view",
  "members_manage",
] as const;

export type ShopPermission = (typeof SHOP_PERMISSION_KEYS)[number];

export type ShopMemberRole = "owner" | "member";

type PermissionMeta = {
  label: string;
  description: string;
  /** true の権限は「管理者一歩手前」。付けるときに確認の文言を出す */
  sensitive?: boolean;
};

export const SHOP_PERMISSION_META: Record<ShopPermission, PermissionMeta> = {
  store_edit: {
    label: "店舗情報の編集",
    description: "店名・商品・写真・出店日を変える",
  },
  post: {
    label: "近況の投稿",
    description: "近況を出す・出し直す・消す",
  },
  ai_notes: {
    label: "にちよさんの覚えごと",
    description: "にちよさんが覚えちゅうことを見る・直す・消す（お客さんへの答えにも出る）",
  },
  inquiries: {
    label: "運営・市役所との連絡",
    description: "お知らせを見る・質問や相談を送る",
  },
  analytics: {
    label: "お店の分析",
    description: "見られた回数とお客さんの反応を見る",
  },
  audit_view: {
    label: "操作ログの閲覧",
    description: "誰がいつ何をしたかを見る",
  },
  members_manage: {
    label: "メンバーの管理",
    description: "招待リンク・QRの発行、メンバーの追加・削除、権限の変更（代表者の変更や退会はできない）",
    sensitive: true,
  },
};

/** 招待リンクを作るときの選択肢。画面で選んだものを土台に、1つずつ付け外しできる。 */
export const SHOP_PERMISSION_PRESETS = {
  /** 近況と店舗情報だけ。家族が店先で手伝うときの標準 */
  helper: {
    label: "お手伝い",
    description: "店舗情報の編集と近況の投稿",
    permissions: ["store_edit", "post"],
  },
  /** 運営まわり以外はひと通り */
  staff: {
    label: "スタッフ",
    description: "お手伝い＋覚えごと・分析・連絡",
    permissions: ["store_edit", "post", "ai_notes", "inquiries", "analytics"],
  },
  /** 代表者の次に強い。メンバー管理とログ閲覧まで */
  deputy: {
    label: "副代表",
    description: "代表者以外のほぼすべて（メンバー管理・操作ログを含む）",
    permissions: [...SHOP_PERMISSION_KEYS],
  },
} as const satisfies Record<string, { label: string; description: string; permissions: readonly ShopPermission[] }>;

export type ShopPermissionPresetKey = keyof typeof SHOP_PERMISSION_PRESETS;

/** 招待リンクの決まり（DB・API・画面で同じ値を使う） */
export const SHOP_INVITE_RULES = {
  /** 有効期限（日） */
  expiresInDays: 7,
  /** 1本のリンクで入れる人数の範囲 */
  minUses: 1,
  maxUses: 5,
} as const;

const PERMISSION_SET: ReadonlySet<string> = new Set(SHOP_PERMISSION_KEYS);

export function isShopPermission(value: unknown): value is ShopPermission {
  return typeof value === "string" && PERMISSION_SET.has(value);
}

/**
 * 外から来た値を、知っている権限キーだけに絞って重複を除く（順番は SHOP_PERMISSION_KEYS に揃える）。
 * 配列でなければ null。知らないキーが混ざっていても落とさず無視する。
 */
export function parseShopPermissions(value: unknown): ShopPermission[] | null {
  if (!Array.isArray(value)) return null;
  const picked = new Set(value.filter(isShopPermission));
  return SHOP_PERMISSION_KEYS.filter((key) => picked.has(key));
}

export type ShopMembership = {
  role: ShopMemberRole;
  permissions: readonly ShopPermission[];
};

/** 代表者は権限の中身にかかわらず常に true（DB の has_shop_permission と同じ規則）。 */
export function hasShopPermission(
  membership: ShopMembership | null | undefined,
  permission: ShopPermission,
): boolean {
  if (!membership) return false;
  if (membership.role === "owner") return true;
  return membership.permissions.includes(permission);
}
