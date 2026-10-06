"use client";

import { useParams } from "next/navigation";
import JoinShopFlow from "@/components/vendor/join/JoinShopFlow";

/** 運営から配られた QR コードで、店舗の代表者として登録するページ。QR の行き先は /claim/<トークン> */
export default function ClaimPage() {
  const { token } = useParams<{ token: string }>();
  return <JoinShopFlow kind="claim" token={token} />;
}
