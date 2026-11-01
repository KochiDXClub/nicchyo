import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PreparingNotice from "./PreparingNotice";

const stopMapLoading = vi.fn();
vi.mock("./MapLoadingProvider", () => ({
  useMapLoading: () => ({ stopMapLoading }),
}));

describe("PreparingNotice", () => {
  it("準備中の文言を出し、/map へのリンクで立ったローディングをすぐ畳む", () => {
    const { getByText } = render(<PreparingNotice />);
    expect(getByText("ただいま準備中です")).toBeTruthy();
    expect(stopMapLoading).toHaveBeenCalled();
  });
});
