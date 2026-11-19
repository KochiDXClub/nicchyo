import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { privateNoStoreHeaders } from "@/lib/http/cacheHeaders";
import { embeddingSyncClient } from "../sync-embeddings/_history";

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  try {
    const { data, error } = await embeddingSyncClient(auth.adminClient).rpc("read_embedding_sync_history").single();
    if (error) throw error;
    return NextResponse.json(data, { headers: privateNoStoreHeaders() });
  } catch (error) {
    console.error("[embedding-runs] history unavailable", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
