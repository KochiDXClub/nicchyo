import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/types/database.types";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FeedbackBodySchema = z.object({
  consultId: z.string().uuid(),
  turnIndex: z.number().int().min(0).max(10),
  rating: z.union([z.literal(1), z.literal(-1)]),
  comment: z.string().max(500).nullable().optional(),
  questionText: z.string().max(2000).optional(),
  turnText: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "grandma-feedback",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const parsed = FeedbackBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ message: "Server configuration error" }, { status: 500 });
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data } = parsed;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("ai_consult_feedback").insert({
    consult_id: data.consultId,
    turn_index: data.turnIndex,
    rating: data.rating,
    comment: data.comment ?? null,
    question_text: data.questionText ?? null,
    turn_text: data.turnText ?? null,
  });

  if (error) {
    console.error("[ai_consult_feedback] insert failed:", error.message);
    return NextResponse.json({ message: "Failed to save feedback" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
