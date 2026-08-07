import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeAdmin } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

// 拡張子は next/image が扱える形式に限定する。MIME だけを信じない
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** 先頭バイトから実際の画像形式を判定する。判定できなければ null */
function sniffImageType(head: Uint8Array): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return "image/png";
  }
  // RIFF....WEBP
  if (
    head.length >= 12 &&
    head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
    head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * カレンダーのカード画像をアップロードする。
 *
 * ストレージのポリシーは出店者の自分フォルダ運用を前提にしているため、
 * 運営の画像はサービスロールで market-events/ 配下に置く（管理者認可の後にのみ実行）。
 * 返す公開URLは validateImageUrl が通す形式と一致する。
 */
export async function POST(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-events-image",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let file: File | null = null;
  try {
    const form = await req.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json({ error: "無効なリクエストです" }, { status: 400 });
  }

  if (!file) return NextResponse.json({ error: "画像が指定されていません" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "画像が空です" }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "画像は5MB以内にしてください" }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "JPG / PNG / WEBP のみアップロードできます" },
      { status: 400 }
    );
  }

  // file.type は multipart のヘッダ由来でクライアントが自由に名乗れる。
  // 実バイト列を見て、HTML や SVG を画像として保存されるのを防ぐ。
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (sniffImageType(head) !== file.type) {
    return NextResponse.json({ error: "画像ファイルが不正です" }, { status: 400 });
  }

  const path = `market-events/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await dc.storage
    .from("vendor-images")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "アップロードに失敗しました" }, { status: 500 });
  }

  // サービスロールによる特権書き込みなので、他の管理操作と同様に痕跡を残す
  const { error: auditError } = await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "event_image_uploaded",
    target_type: "market_event_image",
    target_id: path,
    details: JSON.stringify({ size: file.size, type: file.type }),
  });
  if (auditError) {
    console.error("[admin/events/image] 監査ログの記録に失敗しました", auditError);
  }

  const { data } = dc.storage.from("vendor-images").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
