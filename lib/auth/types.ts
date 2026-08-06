/**
 * 認証・ユーザー関連の型定義
 */

export type UserRole = "admin" | "moderator" | "vendor" | "general_user";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  vendorId?: string;
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
  canManageAllShops: boolean;
  canModerateContent: boolean;
}
