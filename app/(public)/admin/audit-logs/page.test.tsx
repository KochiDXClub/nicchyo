import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => ({ permissions: { isAdmin: true }, isLoading: false }) }));
// 表・絞り込み・件数・出力は本物の共通部品で描く。サイドバーだけ外す
vi.mock("@/components/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/admin")>()),
  AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import AuditLogsPage from "./page";

const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

const LOGS = [
  { id: 3, actor_email: "admin@example.com", actor_role: "admin", action: "shop_deleted", target_type: "shop", target_id: "12", target_name: "高知の野菜", details: null, ip_address: null, created_at: daysAgo(0) },
  { id: 2, actor_email: "mod@example.com", actor_role: "moderator", action: "user_role_changed", target_type: "user", target_id: null, target_name: null, details: "vendor に変更", ip_address: null, created_at: daysAgo(3) },
  { id: 1, actor_email: "old@example.com", actor_role: "admin", action: "shop_created", target_type: "shop", target_id: "5", target_name: "古い店", details: null, ip_address: null, created_at: daysAgo(20) },
];

const STATS = { total: 42, today: 5, admin: 30, moderator: 12 };

/** API の代わり。period / role で絞った行を返す（本物は DB で絞る） */
const fetchMock = vi.fn(async (input: string) => {
  const params = new URL(input, "http://localhost").searchParams;
  const role = params.get("role");
  const logs = LOGS.filter((l) => role === "all" || l.actor_role === role).filter(
    (l) => params.get("period") !== "week" || new Date(l.created_at) >= new Date(daysAgo(7))
  );
  return { ok: true, json: async () => ({ logs, total: logs.length === LOGS.length ? 42 : logs.length, stats: STATS }) };
});

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

/** 表の本文の行（見出しの行を除く）の実行者 */
function actorsInTable() {
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  return rows.map((row) => within(row).getAllByRole("cell")[1].textContent);
}

describe("監査ログ（共通基盤の一覧表で描く）", () => {
  it("件数のまとめは API が全体から数えた値を出し、一覧は API の順（新しい順）のまま", async () => {
    render(<AuditLogsPage />);
    await screen.findByRole("table");

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/audit-logs?period=all&role=all");
    expect(screen.getByText("総ログ数").nextSibling?.textContent).toBe("42");
    expect(screen.getByText("管理者操作").nextSibling?.textContent).toBe("30");
    expect(actorsInTable()).toEqual(["admin@example.comadmin", "mod@example.commoderator", "old@example.comadmin"]);
    expect(screen.getByText("店舗削除")).toBeTruthy();
    // 条件に合う件数が読み込んだ件数より多いときは、絞ると古い記録も出ることを添える
    expect(screen.getByText(/3 件表示 \/ 条件に合う 42 件（新しい順に 3 件まで読み込み/)).toBeTruthy();
  });

  it("ロール・期間は API に渡して絞り直し、検索は読み込んだ分の中で絞る", async () => {
    render(<AuditLogsPage />);
    await screen.findByRole("table");

    fireEvent.click(screen.getByRole("button", { name: /^モデレーター/ }));
    await waitFor(() => expect(actorsInTable()).toEqual(["mod@example.commoderator"]));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/audit-logs?period=all&role=moderator");

    fireEvent.click(screen.getByRole("button", { name: /^全ロール/ }));
    fireEvent.click(screen.getByRole("button", { name: "7日間" }));
    await waitFor(() => expect(actorsInTable()).toHaveLength(2));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/audit-logs?period=week&role=all");

    const calls = fetchMock.mock.calls.length;
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "高知" } });
    expect(actorsInTable()).toEqual(["admin@example.comadmin"]);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("日時の見出しを押すと古い順に並べ替わる", async () => {
    render(<AuditLogsPage />);
    await screen.findByRole("table");

    fireEvent.click(screen.getByRole("button", { name: /日時/ }));
    expect(actorsInTable()[0]).toBe("old@example.comadmin");
  });

  it("CSV / JSON の出力ボタンを見出しに出す", async () => {
    render(<AuditLogsPage />);
    await screen.findByRole("table");
    expect(screen.getByRole("button", { name: "CSVファイルをエクスポート" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "JSONファイルをエクスポート" })).toBeTruthy();
  });
});
