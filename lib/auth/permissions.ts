import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "./types";

/** app_metadata.role から文字列ロールを取り出す（unknown 型の user 対応） */
export function getRole(user: unknown): string | null {
  if (!user || typeof user !== "object") return null;
  const record = user as { app_metadata?: { role?: string } };
  return record.app_metadata?.role ?? null;
}

/**
 * ロール階層（高い順）。新しいロールを追加する場合はここに追記する。
 *   admin > moderator > vendor > general_user
 */
export const ROLE_HIERARCHY = ["admin", "moderator", "vendor", "general_user"] as const;

/** admin ロールかどうかを判定する */
export function isAdmin(role: string | null): boolean {
  return role === "admin";
}

/** moderator 以上のロール（moderator / admin）かどうかを判定する */
export function isModerator(role: string | null): boolean {
  return role === "moderator" || isAdmin(role);
}

/** vendor ロールかどうかを判定する */
export function isVendor(role: string | null): boolean {
  return role === "vendor";
}

/** app_metadata の生ロール文字列を UserRole 型に正規化する */
export function normalizeRole(value?: string | null): UserRole {
  if (value === "admin") return "admin";
  if (value === "moderator") return "moderator";
  if (value === "vendor") return "vendor";
  return "general_user";
}

/** vendor ロール以外を 403 で弾く（API Route 用ガード） */
export function requireVendorRole(user: User): NextResponse | null {
  if (getRole(user) !== "vendor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
