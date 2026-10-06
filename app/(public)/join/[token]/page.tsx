"use client";

import { useParams } from "next/navigation";
import JoinShopFlow from "@/components/vendor/join/JoinShopFlow";

/** 招待リンクで店舗に参加するページ。代表者などが作った /join/<トークン> の行き先 */
export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  return <JoinShopFlow kind="invite" token={token} />;
}
