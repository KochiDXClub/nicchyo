import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { GET as getHistory } from "../embedding-runs/route";
import { syncKnowledgeEmbeddings, syncVendorEmbeddings } from "./_sync";
import { GET, POST } from "./route";

const db = vi.hoisted(() => {
  const single = vi.fn();
  return { single, client: { rpc: vi.fn(() => ({ single })) } };
});

vi.mock("@/lib/auth/requireAdminApi", () => ({
  requireAdminApi: vi.fn(),
  createAdminServiceClient: () => db.client,
}));
vi.mock("./_sync", () => ({
  syncKnowledgeEmbeddings: vi.fn(),
  syncVendorEmbeddings: vi.fn(),
}));

const endpoint = "http://localhost/api/admin/sync-embeddings";
const run = { id: "run-1", started_at: "2026-11-19T00:00:00Z" };

function postRequest(target?: string, headers?: HeadersInit) {
  return new NextRequest(endpoint, {
    method: "POST",
    headers: { origin: "http://localhost", ...headers },
    body: target === undefined ? undefined : JSON.stringify({ target }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test");
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.mocked(requireAdminApi).mockResolvedValue({
    user: { id: "actor" },
    adminClient: db.client,
  } as unknown as Awaited<ReturnType<typeof requireAdminApi>>);
  db.client.rpc.mockReturnValue({ single: db.single });
  db.single
    .mockResolvedValueOnce({ data: run, error: null })
    .mockResolvedValueOnce({ data: { finished_at: "2026-11-19T00:00:01Z", version_number: 2 }, error: null });
});

afterEach(() => vi.unstubAllEnvs());

describe("embedding management", () => {
  it("rejects unprivileged access and invalid script credentials", async () => {
    vi.mocked(requireAdminApi).mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) });

    expect((await POST(postRequest("knowledge"))).status).toBe(401);
    expect((await POST(postRequest("knowledge", { authorization: "Bearer incorrect" }))).status).toBe(401);
    expect((await getHistory()).status).toBe(401);
    expect((await GET(new NextRequest(endpoint))).status).toBe(401);
    expect(db.client.rpc).not.toHaveBeenCalled();
  });

  it("rejects cross-origin manual updates", async () => {
    expect((await POST(postRequest("knowledge", { origin: "https://other.example" }))).status).toBe(403);
    expect(db.client.rpc).not.toHaveBeenCalled();
  });

  it("publishes the exact count of a completed manual knowledge build", async () => {
    vi.mocked(syncKnowledgeEmbeddings).mockImplementation(async ({ runId, recordProcessed }) => {
      expect(runId).toBe(run.id);
      recordProcessed(31);
    });

    const response = await POST(postRequest("knowledge"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, processed: 31, version: 2 });
    expect(db.client.rpc).toHaveBeenNthCalledWith(1, "begin_embedding_sync", {
      p_target: "knowledge", p_source: "manual", p_actor_id: "actor",
    });
    expect(db.client.rpc).toHaveBeenNthCalledWith(2, "finish_embedding_sync", {
      p_run_id: run.id, p_succeeded: true, p_processed_count: 31,
    });
    expect(syncVendorEmbeddings).not.toHaveBeenCalled();
  });

  it("discards staging and records the partial count when a scheduled build fails", async () => {
    using log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(syncVendorEmbeddings).mockImplementation(async ({ recordProcessed }) => {
      recordProcessed(50);
      throw new Error("upstream failure");
    });

    const response = await GET(new NextRequest(endpoint, { headers: { authorization: "Bearer cron-secret" } }));

    expect(response.status).toBe(500);
    expect(db.client.rpc).toHaveBeenNthCalledWith(1, "begin_embedding_sync", {
      p_target: "vendors", p_source: "scheduled", p_actor_id: null,
    });
    expect(db.client.rpc).toHaveBeenNthCalledWith(2, "finish_embedding_sync", {
      p_run_id: run.id, p_succeeded: false, p_processed_count: 50,
    });
    expect(log).toHaveBeenCalled();
  });

  it("cleans staging if the database rejects promotion", async () => {
    using log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.single.mockReset()
      .mockResolvedValueOnce({ data: run, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "P0001" } })
      .mockResolvedValueOnce({ data: { version_number: null }, error: null });
    const response = await POST(postRequest());
    expect(response.status).toBe(500);
    expect(db.client.rpc).toHaveBeenLastCalledWith("finish_embedding_sync", {
      p_run_id: run.id, p_succeeded: false, p_processed_count: 0,
    });
    expect(log).toHaveBeenCalled();
  });

  it("uses the same publication path for scripts", async () => {
    const response = await POST(postRequest("knowledge", { authorization: "Bearer cron-secret" }));
    expect(response.status).toBe(200);
    expect(db.client.rpc).toHaveBeenNthCalledWith(1, "begin_embedding_sync", {
      p_target: "knowledge", p_source: "script", p_actor_id: null,
    });
  });

  it("skips generation when the per-target lock is already held", async () => {
    db.single.mockReset().mockResolvedValue({ data: null, error: { code: "23505" } });

    expect((await POST(postRequest())).status).toBe(409);
    expect(db.client.rpc).toHaveBeenCalledTimes(1);
    expect(syncVendorEmbeddings).not.toHaveBeenCalled();
  });

  it("returns history and both active versions without sharing the response cache", async () => {
    const data = { runs: [{ id: run.id, status: "interrupted" }], vendors: 3, knowledge: 2 };
    db.single.mockReset().mockResolvedValue({ data, error: null });

    const response = await getHistory();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual(data);
  });
});
