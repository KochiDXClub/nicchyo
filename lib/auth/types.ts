/**
 * 認証・ユーザー関連の型定義
 */

import type { ShopMembership, ShopPermission } from "@/lib/vendor/shopPermissions";

export type UserRole = "admin" | "moderator" | "vendor" | "general_user";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  /** 所属店舗の ID（vendors.id）。アカウントの ID（id）とは別物 */
  vendorId?: string;
  /** 所属店舗での立場と権限。店舗に入っていなければ undefined */
  shopMembership?: ShopMembership;
  /** 認証プロバイダー。"email" = メール/パスワード、"google" = Googleログイン */
  provider: "email" | "google" | string;
}

export interface PermissionCheck {
  /** admin ロール（最上位権限）。API 側の isAdmin() と対応 */
  isAdmin: boolean;
  /** moderator 以上（moderator / admin）。API 側の isModerator() と対応 */
  isModerator: boolean;
  isVendor: boolean;
  isGeneralUser: boolean;
  canEditShop: (shopVendorId: string) => boolean;
  /** 自分の所属店舗で、その操作をしてよいか（代表者は常に true） */
  canShop: (permission: ShopPermission) => boolean;
  canManageAllShops: boolean;
  canModerateContent: boolean;
}
