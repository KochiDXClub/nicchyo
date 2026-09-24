import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/utils/supabase/client", () => ({ createClient: mocks.createClient }));

import { AuthProvider, useAuth } from "./AuthContext";

function fakeClient() {
  return {
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      signInWithPassword: mocks.signInWithPassword,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  };
}

let auth: ReturnType<typeof useAuth>;
function Probe() {
  auth = useAuth();
  return <p>{auth.isLoading ? "loading" : auth.isLoggedIn ? `in:${auth.user?.name}` : "out"}</p>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockImplementation(fakeClient);
  });

  it("Supabase を読み込んでからログイン状態を反映する", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "taro@example.com", app_metadata: {}, user_metadata: { name: "太郎" } } },
      error: null,
    });
    render(<AuthProvider><Probe /></AuthProvider>);
    expect(screen.getByText("loading")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("in:太郎")).toBeTruthy());
    expect(mocks.createClient).toHaveBeenCalledTimes(1);
  });

  it("未ログインなら読み込み後に未ログインになる", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError", message: "" } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("out")).toBeTruthy());
  });

  it("ログインとログアウトは同じクライアントを使い回す", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "u2", email: "hanako@example.com", app_metadata: {}, user_metadata: {} } },
      error: null,
    });
    mocks.signOut.mockResolvedValue({ error: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("out")).toBeTruthy());
    // クライアントはページ全体で1つ。ログイン・ログアウトで作り直さない
    const created = mocks.createClient.mock.calls.length;

    await act(async () => {
      await auth.loginWithCredentials("hanako@example.com", "pw");
    });
    expect(screen.getByText("in:hanako")).toBeTruthy();

    await act(async () => {
      await auth.logout();
    });
    expect(screen.getByText("out")).toBeTruthy();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.createClient.mock.calls.length).toBe(created);
  });
});
