import React from "react";
import { render, screen } from "@testing-library/react";
import QrSheet from "./QrSheet";

describe("QrSheet", () => {
  it("発行できた店舗ごとに、店名とQRコードのカードを出す（発行できなかった店舗は出さない）", () => {
    render(
      <QrSheet
        results={[
          { vendorId: "a", shopName: "山田農園", status: "ok", url: "https://nicchyo.example/claim/aaaaaaaaaaaaaaaaaaaaaaaa" },
          { vendorId: "b", shopName: "田中商店", status: "already_claimed" },
          { vendorId: "c", shopName: "佐藤青果", status: "ok", url: "https://nicchyo.example/claim/bbbbbbbbbbbbbbbbbbbbbbbb" },
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("山田農園")).toBeInTheDocument();
    expect(screen.getByText("佐藤青果")).toBeInTheDocument();
    expect(screen.queryByText("田中商店")).not.toBeInTheDocument();
    expect(screen.getByTitle("山田農園のQRコード")).toBeInTheDocument();
    // 使い方の案内も、QR と一緒に印刷される
    expect(screen.getAllByText(/Googleアカウントでログインすると/)).toHaveLength(2);
  });

  it("印刷では、このシートだけを残す（それ以外を隠すスタイルを持つ）", () => {
    const { container } = render(
      <QrSheet results={[{ vendorId: "a", shopName: "山田農園", status: "ok", url: "https://nicchyo.example/claim/aaaaaaaaaaaaaaaaaaaaaaaa" }]} />,
    );

    expect(container.querySelector("style")?.textContent).toMatch(/@media print[\s\S]*body \*[\s\S]*visibility: hidden/);
  });

  it("発行できたものがなければ何も出さない", () => {
    const { container } = render(<QrSheet results={[{ vendorId: "a", shopName: "x", status: "already_claimed" }]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
