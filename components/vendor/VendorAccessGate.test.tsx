import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import VendorAccessGate from "./VendorAccessGate";

let pathname = "/my-shop";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

type Auth = {
  isLoading: boolean;
  user: Record<string, unknown> | null;
  permissions: { isVendor: boolean; canShop: (key: string) => boolean };
};
let auth: Auth;
vi.mock("@/lib/auth/AuthContext", () => ({ useAuth: () => auth }));

const vendor = (extra: Record<string, unknown> = {}) => ({ id: "u1", role: "vendor", vendorId: "shop-1", ...extra });

function setup(overrides: Partial<Auth> = {}) {
  auth = {
    isLoading: false,
    user: vendor(),
    permissions: { isVendor: true, canShop: () => true },
    ...overrides,
  };
  return render(
    <VendorAccessGate kicker="Vendor Dashboard">
      <p>中身</p>
    </VendorAccessGate>,
  );
}

afterEach(() => {
  pathname = "/my-shop";
});

describe("VendorAccessGate", () => {
  it("店舗に入っている出店者なら中身を出す", () => {
    setup();
    expect(screen.getByText("中身")).toBeInTheDocument();
  });

  it("読み込み中・未ログイン・出店者でない、はそれぞれの案内を出す", () => {
    const { unmount } = setup({ isLoading: true });
    expect(screen.getByText("読み込み中です")).toBeInTheDocument();
    unmount();

    const second = setup({ user: null });
    expect(screen.getByText("ログインしてください")).toBeInTheDocument();
    second.unmount();

    setup({ permissions: { isVendor: false, canShop: () => false } });
    expect(screen.getByText("出店者専用です")).toBeInTheDocument();
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
  });

  it("店舗に入っていない出店者ロールには、参加の方法を案内する", () => {
    setup({ user: vendor({ vendorId: undefined }) });
    expect(screen.getByText("お店に参加していません")).toBeInTheDocument();
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
  });

  it("所属を引く通信が失敗したときは、「参加していません」ではなく「もう一度」を出す", () => {
    setup({ user: vendor({ vendorId: undefined, shopMembershipLookupFailed: true }) });
    expect(screen.getByText("読み込めませんでした")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度読み込む" })).toBeInTheDocument();
    expect(screen.queryByText("お店に参加していません")).not.toBeInTheDocument();
  });

  it("権限のない画面を直接開いたときは、権限がないと案内する。権限が要らない画面は開ける", () => {
    pathname = "/vendor/analytics";
    const denied = setup({ permissions: { isVendor: true, canShop: (key) => key !== "analytics" } });
    expect(screen.getByText("この画面を使う権限がありません")).toBeInTheDocument();
    expect(screen.queryByText("中身")).not.toBeInTheDocument();
    denied.unmount();

    pathname = "/my-shop/schedule";
    const schedule = setup({ permissions: { isVendor: true, canShop: (key) => key === "post" } });
    expect(screen.getByText("この画面を使う権限がありません")).toBeInTheDocument();
    schedule.unmount();

    pathname = "/vendor/account";
    setup({ permissions: { isVendor: true, canShop: () => false } });
    expect(screen.getByText("中身")).toBeInTheDocument();
  });
});
