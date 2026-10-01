"use client";

import { useAuth } from "@/lib/auth/AuthContext";
import VendorAskSession from "./VendorAskSession";

/**
 * にちよさんの質問に答えるページ。出店者トップの吹き出し（「！」）から来る。
 * ログインと出店者ロールの確認は my-shop のレイアウト（と proxy）が行う。
 */
export default function VendorAskPage() {
  const { user } = useAuth();
  if (!user?.id) return null;
  return <VendorAskSession vendorId={user.id} />;
}
