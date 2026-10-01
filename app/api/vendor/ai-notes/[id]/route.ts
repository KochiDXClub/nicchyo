import { NextResponse } from "next/server";
import { z } from "zod";
import { AiNoteInputSchema, rowToAiNote, type StoreKnowledgeRow } from "@/lib/vendor/aiNotes";
import { embedNote, NOTE_COLUMNS, requireVendorWrite, toNoteRow } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IdSchema = z.string().uuid();

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH: ノートを書き直す（トピックタイトルか本文が変わったらベクトルも作り直す）
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireVendorWrite(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const id = IdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = AiNoteInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力を確かめてください" }, { status: 400 });
  }

  // RLS で本人の行しか見えないが、store_id でも明示して絞る
  const { data: current, error: readError } = await supabase
    .from("store_knowledge")
    .select("title, content")
    .eq("id", id.data)
    .eq("store_id", user.id)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const textChanged = current.title !== parsed.data.title || current.content !== parsed.data.content;
  // 届け先だけを変えたときは、ベクトルを作り直さない（OpenAI を呼ばない）
  const embedding = textChanged ? await embedNote(parsed.data) : undefined;
  const update = {
    ...toNoteRow(parsed.data),
    updated_at: new Date().toISOString(),
    ...(embedding !== undefined ? { embedding: embedding as unknown as string | null } : {}),
  };

  const { data, error } = await supabase
    .from("store_knowledge")
    .update(update)
    .eq("id", id.data)
    .eq("store_id", user.id)
    .select(NOTE_COLUMNS)
    .single();

  if (error || !data) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  return NextResponse.json({ note: rowToAiNote(data as unknown as StoreKnowledgeRow) });
}

/**
 * DELETE: ノートを消す
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireVendorWrite(request);
  if (!auth.ok) return auth.response;
  const { supabase, user } = auth;

  const id = IdSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("store_knowledge")
    .delete()
    .eq("id", id.data)
    .eq("store_id", user.id)
    .select("id");

  if (error) return NextResponse.json({ error: "消せませんでした" }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
