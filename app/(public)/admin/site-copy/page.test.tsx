import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_SITE_COPY } from "@/lib/site-copy/content";
import SiteCopyAdminPage from "./page";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/admin", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("下書きを編集し、差分確認を経て公開する", async () => {
  const fetchMock = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => {
    if (options?.method === "PUT") return { ok: true, json: async () => ({ revision: 1 }) };
    return { ok: true, json: async () => ({ draft: DEFAULT_SITE_COPY, published: DEFAULT_SITE_COPY, revision: 0, history: [] }) };
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<SiteCopyAdminPage />);
  const title = await screen.findByDisplayValue(DEFAULT_SITE_COPY.texts["faq.title"]);
  fireEvent.change(title, { target: { value: "新しい見出し" } });
  fireEvent.click(screen.getByRole("button", { name: "公開前の差分を確認" }));
  expect(screen.getByText("変更後：新しい見出し")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "この内容を公開" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/site-copy", expect.objectContaining({ method: "PUT", body: expect.stringContaining('"publish":true') })));
});
