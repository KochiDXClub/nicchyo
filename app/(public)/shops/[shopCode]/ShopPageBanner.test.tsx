import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { ShopProfile } from "../../map/types/shopData";
import ShopPageBanner from "./ShopPageBanner";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../../map/components/ShopDetailBanner", () => ({ default: ({ onNavigate }: { onNavigate?: () => void }) => <div>{onNavigate ? "案内あり" : "案内なし"}</div> }));

it("場所が未確定の店舗には案内操作を渡さない", () => {
  render(<ShopPageBanner shop={{ id: 1001, hasMapLocation: false } as ShopProfile} shopCode="1001" />);
  expect(screen.getByText("案内なし")).toBeInTheDocument();
});
