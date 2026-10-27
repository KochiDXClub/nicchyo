import type { BadgeProps } from "@/components/ui";
import type { UserRole } from "@/lib/auth/types";

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "管理者",
  vendor: "出店者",
  general_user: "一般",
  moderator: "モデレーター",
};

export const ROLE_BADGE_VARIANT: Record<UserRole, NonNullable<BadgeProps["variant"]>> = {
  admin: "caution",
  vendor: "info",
  general_user: "neutral",
  moderator: "ai",
};
