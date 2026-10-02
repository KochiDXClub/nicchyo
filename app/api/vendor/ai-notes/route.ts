import { NextResponse } from "next/server";
import {
  AiNoteInputSchema,
  DEFAULT_AI_SETTINGS,
  rowToAiNote,
  type AiSettings,
  type StoreKnowledgeRow,
} from "@/lib/vendor/aiNotes";
import { embedNote, NOTE_COLUMNS, requireVendor, requireVendorWrite, toNoteRow } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1店舗が持てるノートの上限。にちよさんに渡す量と画面の長さを抑える */
const MAX_NOTES = 50;

/**
 * GET: 自分のノートの一覧と、にちよさんに渡すものの設定
 */
export async function GET() {
  const auth = await requireVendor("ai_notes");
  if (!auth.ok) return auth.response;
  const { supabase, vendorId } = auth;

  const [notesResult, settingsResult] = await Promise.all([
    supabase
      .from("store_knowledge")
      .select(NOTE_COLUMNS)
      .eq("store_id", vendorId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("vendor_ai_settings")
      .select("use_stats_in_vendor_help, share_popular_with_visitors")
      .eq("vendor_id", vendorId)
      .maybeSingle(),
  ]);

  if (notesResult.error || settingsResult.error) {
    return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  }

  const row = settingsResult.data;
  const settings: AiSettings = row
    ? {
        useStatsInVendorHelp: row.use_stats_in_vendor_help,
        sharePopularWithVisitors: row.share_popular_with_visitors,
      }
    : DEFAULT_AI_SETTINGS;

  return NextResponse.json({
    notes: ((notesResult.data ?? []) as unknown as StoreKnowledgeRow[]).map(rowToAiNote),
    settings,
  });
}

/**
 * POST: ノートを1枚足す（検索用のベクトルも作る）
 */
export async function POST(request: Request) {
  const auth = await requireVendorWrite(request, "ai_notes");
  if (!auth.ok) return auth.response;
  const { supabase, vendorId } = auth;

  const parsed = AiNoteInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力を確かめてください" }, { status: 400 });
  }

  const { count, error: countError } = await supabase
    .from("store_knowledge")
    .select("id", { count: "exact", head: true })
    .eq("store_id", vendorId);
  if (countError) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  if ((count ?? 0) >= MAX_NOTES) {
    return NextResponse.json({ error: `ノートは${MAX_NOTES}枚までです。古いものを消してから足してください` }, { status: 400 });
  }

  const embedding = await embedNote(parsed.data);
  const { data, error } = await supabase
    .from("store_knowledge")
    .insert({
      store_id: vendorId,
      ...toNoteRow(parsed.data),
      // 新しいノートは下に並べる
      sort_order: count ?? 0,
      embedding: embedding as unknown as string | null,
    })
    .select(NOTE_COLUMNS)
    .single();

  if (error || !data) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });
  return NextResponse.json({ note: rowToAiNote(data as unknown as StoreKnowledgeRow) });
}
