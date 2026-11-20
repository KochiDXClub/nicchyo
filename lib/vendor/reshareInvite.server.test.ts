import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { hashInviteToken } from "./shopInvites.server";
import { reshareInviteToken, resolveInviteHash } from "./reshareInvite.server";
import { InviteTokenSchema } from "./shopInvites";

afterEach(() => vi.unstubAllEnvs());

it("発行時と再共有のURLが同じ招待に対応し、署名を書き換えたURLは無効", async () => {
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-signing-key");
  const original = "a".repeat(32);
  const hash = hashInviteToken(original);
  const id = "54a0257b-efac-4eaa-96d0-395ab9d0f704";
  const db = { from: () => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: { token_hash: hash } }),
  }) }) }) } as unknown as SupabaseClient;
  const token = reshareInviteToken(id, hash);
  expect(InviteTokenSchema.parse(token)).toBe(token);
  expect(await resolveInviteHash(db, original)).toBe(hash);
  expect(await resolveInviteHash(db, token)).toBe(hash);
  expect(await resolveInviteHash(db, token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"))).toBeNull();
});
