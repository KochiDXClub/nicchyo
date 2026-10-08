// 招待リンク・QR コードで店舗に参加する画面の API 呼び出し。
// 参加の確認（preview）はログイン前でも呼べる。参加（accept / claim）はログインが要る。

import { apiRequest } from "@/lib/utils/apiRequest";
import type { ShopPermission } from "@/lib/vendor/shopPermissions";

export type JoinKind = "invite" | "claim";

export type JoinPreview =
  | { status: "ok"; shopName: string; permissions: ShopPermission[]; expiresAt: string | null }
  | { status: "unavailable"; message: string };

const ENDPOINT: Record<JoinKind, { preview: string; accept: string }> = {
  invite: { preview: "/api/vendor/invites/preview", accept: "/api/vendor/invites/accept" },
  claim: { preview: "/api/vendor/claim/preview", accept: "/api/vendor/claim" },
};

type PreviewResponse =
  | { status: "ok"; shopName: string; permissions?: ShopPermission[]; expiresAt?: string }
  | { status: string; message: string };

export async function previewJoin(kind: JoinKind, token: string): Promise<JoinPreview> {
  const data = await apiRequest<PreviewResponse>(
    ENDPOINT[kind].preview,
    { method: "POST", body: { token } },
    "リンクを確かめられませんでした。電波の良いところで、もう一度開いてください。",
  );
  if (data.status === "ok" && "shopName" in data) {
    return { status: "ok", shopName: data.shopName, permissions: data.permissions ?? [], expiresAt: data.expiresAt ?? null };
  }
  return { status: "unavailable", message: "message" in data ? data.message : "このリンクは使えません。" };
}

/** 参加する。失敗したときは ApiError（message をそのまま画面に出せる。code は already_member などの分岐用） */
export async function acceptJoin(kind: JoinKind, token: string): Promise<void> {
  await apiRequest(ENDPOINT[kind].accept, { method: "POST", body: { token } }, "参加できませんでした。もう一度お試しください。");
}
