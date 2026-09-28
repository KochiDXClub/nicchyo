import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { CODE_AI_CATALOG, DEFAULT_AI_MODEL_SETTINGS } from "@/lib/ai/models";

const requireAdminApi = vi.fn();
const handleConsultAsk = vi.fn();

vi.mock("@/lib/security/requestGuards", () => ({
  requireSameOrigin: () => ({ ok: true }),
}));
vi.mock("@/lib/security/rateLimit", () => ({
  enforceRateLimit: async () => null,
}));
vi.mock("@/lib/auth/requireAdminApi", () => ({
  requireAdminApi: () => requireAdminApi(),
}));
vi.mock("@/lib/ai/modelStore.server", () => ({
  fetchAiRegistry: async () => ({
    catalog: CODE_AI_CATALOG,
    settings: DEFAULT_AI_MODEL_SETTINGS,
  }),
}));
vi.mock("@/app/api/grandma/ask/handler", () => ({
  handleConsultAsk: (...args: unknown[]) => handleConsultAsk(...args),
}));

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/admin/ai-models/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/admin/ai-models/test", () => {
  beforeEach(() => {
    requireAdminApi.mockReset();
    handleConsultAsk.mockReset();
    requireAdminApi.mockResolvedValue({ user: { id: "admin" }, role: "admin", adminClient: {} });
  });

  it("管理者でなければ 401", async () => {
    requireAdminApi.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await post({ modelId: "gpt-4o-mini", question: "アイスはある？" });
    expect(res.status).toBe(401);
    expect(handleConsultAsk).not.toHaveBeenCalled();
  });

  it("台帳に無いモデルは弾く", async () => {
    const res = await post({ modelId: "gpt-999", question: "アイスはある？" });
    expect(res.status).toBe(400);
    expect(handleConsultAsk).not.toHaveBeenCalled();
  });

  it("モデルが受け付けない深さは弾く", async () => {
    const res = await post({
      modelId: "gpt-4o-mini",
      reasoningEffort: "high",
      question: "アイスはある？",
    });
    expect(res.status).toBe(400);
  });

  it("短すぎる質問は弾く（相談本体の判定と揃える）", async () => {
    const res = await post({ modelId: "gpt-4o-mini", question: "氷" });
    expect(res.status).toBe(400);
  });

  it("相談本体をモデル差し替えで呼び、フォールバック先は付けない", async () => {
    handleConsultAsk.mockResolvedValue(
      NextResponse.json({
        reply: "にちよさん: あるよ",
        turns: [{ speakerId: "nichiyosan", speakerName: "にちよさん", text: "あるよ" }],
        shops: [{ id: 12, name: "アイスの店", extra: "ignored" }],
        followUpQuestion: "他には？",
      })
    );

    const res = await post({
      modelId: "gpt-5.4-nano",
      reasoningEffort: "low",
      question: "アイスが食べられるお店はある？",
    });
    expect(res.status).toBe(200);

    const [request, internal] = handleConsultAsk.mock.calls[0] as [
      Request,
      { modelOverride: { def: { id: string }; reasoningEffort?: string; fallbackDef?: unknown } },
    ];
    expect(internal.modelOverride.def.id).toBe("gpt-5.4-nano");
    expect(internal.modelOverride.reasoningEffort).toBe("low");
    // 使えないモデルが既定モデルで「答えたように見える」のを防ぐ
    expect(internal.modelOverride.fallbackDef).toBeUndefined();
    // 本番と同じ経路（非ストリーミング）で質問だけを渡す
    expect(await request.json()).toEqual({
      text: "アイスが食べられるお店はある？",
      stream: false,
    });

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.modelId).toBe("gpt-5.4-nano");
    expect(json.turns).toEqual([{ speakerName: "にちよさん", text: "あるよ" }]);
    expect(json.shops).toEqual([{ id: 12, name: "アイスの店" }]);
    expect(json.followUpQuestion).toBe("他には？");
    expect(typeof json.elapsedMs).toBe("number");
  });

  it("相談本体が失敗したら、その内容をそのまま返す", async () => {
    handleConsultAsk.mockResolvedValue(
      NextResponse.json(
        {
          reply: "いま少し混みゆうみたい。",
          errorCode: "system_error",
          errorMessage: "相談の送信に失敗しました。",
          debugError: "HTTP 400 model_not_found: no access",
        },
        { status: 500 }
      )
    );
    const res = await post({ modelId: "gpt-5.4-nano", question: "アイスはある？" });
    // テストAPI自体は成功。結果の中で「失敗した」と伝える
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.status).toBe(500);
    expect(json.errorCode).toBe("system_error");
    expect(json.debugError).toBe("HTTP 400 model_not_found: no access");
  });
});
