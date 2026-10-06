import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import NoticeList from "./NoticeList";
import type { VendorNotice } from "../../_services/noticesService";

const confirmNotice = vi.fn();
vi.mock("../../_services/noticesService", () => ({ confirmNotice: (id: string) => confirmNotice(id) }));

const notice = (over: Partial<VendorNotice>): VendorNotice => ({
  id: "n1",
  sender: "city",
  title: "区画の配置が変わります",
  body: "10月12日から",
  important: false,
  createdAt: "2026-10-01T00:00:00Z",
  confirmed: false,
  ...over,
});

describe("NoticeList", () => {
  it("まだ確認していないお知らせに「確認しました」を押すと記録して知らせる", async () => {
    confirmNotice.mockResolvedValue(undefined);
    const onConfirmed = vi.fn();
    render(<NoticeList notices={[notice({}), notice({ id: "n2", sender: "operator", title: "古い話", confirmed: true })]} onConfirmed={onConfirmed} />);

    expect(screen.getByText("高知市から")).toBeInTheDocument();
    expect(screen.getByText("まだ確認していない 1件")).toBeInTheDocument();
    // 確認済みのものにはボタンを出さない
    expect(screen.getAllByRole("button", { name: "確認しました" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "確認しました" }));
    expect(confirmNotice).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith("n1"));
  });

  it("記録できなかったら、そう伝える", async () => {
    confirmNotice.mockRejectedValue(new Error("このお知らせは取り下げられました"));
    render(<NoticeList notices={[notice({})]} onConfirmed={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "確認しました" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("このお知らせは取り下げられました");
  });
});
