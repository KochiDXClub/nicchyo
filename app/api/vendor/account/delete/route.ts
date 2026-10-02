import { NextResponse } from "next/server";
import { z } from "zod";
import { logVendorActivity } from "@/lib/vendor/activityLog";
import { requireMembersApi } from "../../members/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ confirm: z.literal(true) });

/** 退会したメンバーに関する操作ログの文面。名前など、誰だったか分かるものは残さない */
const ANONYMIZED_SUMMARY = "退会したメンバーに関する記録";

/**
 * DELETE: 退会する（このアカウントを消す）。店舗のメンバーなら誰でも自分のぶんを退会できる。
 *
 * 消すもの: ログインアカウント／お店に残る自分の氏名（代表者のとき vendor_owner_profiles）／操作ログに載った自分の名前
 * 残すもの: お店の掲載情報（店名・商品・写真・近況）。公開されている情報なので、消したいときは運営に伝えてもらう
 *
 * 代表者は、ほかにメンバーがいる間は退会できない（先に引き継ぎ・409）。メンバーが自分だけなら、
 * お店はアカウントなしの状態に戻る（出ている招待リンクは取り消す。運営が QR を出し直して、次の代表者が紐づく）。
 */
export async function DELETE(request: Request) {
  const auth = await requireMembersApi(request, { write: true, bucket: "vendor-account-delete" });
  if (!auth.ok) return auth.response;
  const { db, vendorId, me, user } = auth;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "退会の確認が必要です" }, { status: 400 });

  // 代表者は、メンバーの確認・招待の取り消し・氏名の削除を、店舗の行を締めた 1 つの処理で行う
  // （確認のあとに招待リンクで人が入って、代表者のいない店舗にメンバーだけが残るのを防ぐ）。
  // やり直しても同じ結果になる操作で、アカウントを消す前に済ませる（途中で失敗しても、もう一度退会できる）
  if (me.role === "owner") {
    const { data: status, error } = await db.rpc("begin_owner_withdrawal", {
      p_vendor_id: vendorId,
      p_user_id: user.id,
    });
    if (error) {
      console.error("[vendor/account/delete] begin_owner_withdrawal error:", error.message);
      return NextResponse.json({ error: "退会できませんでした" }, { status: 500 });
    }
    if (status === "has_members") {
      return NextResponse.json(
        { error: "代表者は、先に別のメンバーへ代表者を引き継いでから退会してください", code: "owner_has_members" },
        { status: 409 },
      );
    }
    if (status !== "ok") return NextResponse.json({ error: "退会できませんでした" }, { status: 403 });
  }

  // 1. 操作ログから、このアカウントが誰だったかを消す（自分がした操作と、自分が対象の操作）
  const { error: anonymizeError } = await db
    .from("vendor_activity_logs")
    .update({ actor_name: null, summary: ANONYMIZED_SUMMARY, details: null })
    .or(`actor_id.eq.${user.id},target_id.eq.${user.id}`);
  if (anonymizeError) {
    console.error("[vendor/account/delete] anonymize error:", anonymizeError.message);
    return NextResponse.json({ error: "退会できませんでした" }, { status: 500 });
  }

  // 2. ログインアカウントを消す（shop_members の行は連動して消える）。失敗したら、1・2 はそのままで、もう一度退会できる
  const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[vendor/account/delete] deleteUser error:", deleteError.message);
    return NextResponse.json({ error: "退会できませんでした。もう一度お試しください" }, { status: 500 });
  }

  await logVendorActivity(db, {
    vendorId,
    actorId: null,
    actorName: null,
    action: "member.withdraw",
    summary: me.role === "owner" ? "代表者が退会した（お店はアカウントなしに戻った）" : "メンバーが退会した",
  });

  return NextResponse.json({ ok: true });
}
