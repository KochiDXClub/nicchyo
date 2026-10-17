import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ logs: LOGS, total: 42 }) })
  );
});
afterEach(() => vi.unstubAllGlobals());

/** 表の本文の行（見出しの行を除く）の実行者 */
function actorsInTable() {
  const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
  return rows.map((row) => within(row).getAllByRole("cell")[1].textContent);
}

describe("監査ログ（共通基盤の一覧表で描く）", () => {
  it("件数のまとめと、API の順（新しい順）の一覧を出す", async () => {
    render(<AuditLogsPage />);
    await screen.findByRole("table");

    expect(screen.getByText("総ログ数").nextSibling?.textContent).toBe("42");
    expect(screen.getByText("管理者操作").nextSibling?.textContent).toBe("2");
    expect(actorsInTable()).toEqual(["admin@example.comadmin", "mod@example.commoderator", "old@example.comadmin"]);
    expect(screen.getByText("店舗削除")).toBeTruthy();
    expect(screen.getByText("3 件表示 / 全 42 件（直近 3 件ロード済み）")).toBeTruthy();
  });

  it("ロール・期間・検索で絞り込める", async () => {
    render(<AuditLogsPage />);
    await screen.findByRole("table");

    fireEvent.click(screen.getByRole("button", { name: /^モデレーター/ }));
    expect(actorsInTable()).toEqual(["mod@example.commoderator"]);

    fireEvent.click(screen.getByRole("button", { name: /^全ロール/ }));
    fireEvent.click(screen.getByRole("button", { name: "7日間" }));
    expect(actorsInTable()).toHaveLength(2);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "高知" } });
    expect(actorsInTable()).toEqual(["admin@example.comadmin"]);
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
