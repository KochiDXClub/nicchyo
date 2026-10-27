import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { ShopPermission } from "@/lib/vendor/shopPermissions";
import PermissionPicker from "./PermissionPicker";

function Harness({ initial, canToggle }: { initial: ShopPermission[]; canToggle: (p: ShopPermission) => boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <PermissionPicker value={value} onChange={setValue} canToggle={canToggle} idPrefix="t" />
      <output data-testid="value">{value.join(",")}</output>
    </>
  );
}

const all = () => true;

describe("PermissionPicker", () => {
  it("チェックで権限を付け外しできる（出る順は定義の順）", () => {
    render(<Harness initial={["post"]} canToggle={all} />);

    fireEvent.click(screen.getByLabelText(/店舗情報の編集/));
    expect(screen.getByTestId("value")).toHaveTextContent("store_edit,post");
    fireEvent.click(screen.getByLabelText(/近況の投稿/));
    expect(screen.getByTestId("value")).toHaveTextContent("store_edit");
  });

  it("ひな形を押すと、その権限の組になる", () => {
    render(<Harness initial={[]} canToggle={all} />);

    fireEvent.click(screen.getByRole("button", { name: "お手伝い" }));
    expect(screen.getByTestId("value")).toHaveTextContent("store_edit,post");
    fireEvent.click(screen.getByRole("button", { name: "副代表" }));
    expect(screen.getByTestId("value")).toHaveTextContent(/members_manage/);
  });

  it("付けられない権限は押せず、ひな形でも変えない。付けられない権限を含むひな形は出さない", () => {
    const noManage = (p: ShopPermission) => p !== "members_manage" && p !== "analytics";
    render(<Harness initial={["analytics"]} canToggle={noManage} />);

    expect(screen.getByLabelText(/メンバーの管理/)).toBeDisabled();
    expect(screen.getByLabelText(/お店の分析/)).toBeDisabled();
    // 副代表のひな形（members_manage を含む）は出さない
    expect(screen.queryByRole("button", { name: "副代表" })).not.toBeInTheDocument();
    // スタッフのひな形は analytics を含むが、押せない権限の今の状態は変えず、すでにある analytics は残る
    fireEvent.click(screen.getByRole("button", { name: "お手伝い" }));
    expect(screen.getByTestId("value")).toHaveTextContent("store_edit,post,analytics");
  });

  it("権限の説明と、管理者に近い権限の注意を出す", () => {
    render(<Harness initial={[]} canToggle={all} />);

    expect(screen.getByText("管理者に近い権限")).toBeInTheDocument();
    expect(screen.getByText(/店名・商品・写真・出店日を変える/)).toBeInTheDocument();
  });

  it("disabled のときは何も押せない", () => {
    const onChange = vi.fn();
    render(<PermissionPicker value={[]} onChange={onChange} canToggle={all} idPrefix="d" disabled />);

    expect(screen.getByLabelText(/店舗情報の編集/)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "お手伝い" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
