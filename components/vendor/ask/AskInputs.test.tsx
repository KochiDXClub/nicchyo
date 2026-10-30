import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ASK_QUESTION_BY_ID, type VendorAskSnapshot } from "@/lib/vendor/askQuestions";
import AskInput from "./AskInputs";

const question = ASK_QUESTION_BY_ID.get("hours")!;

function renderHours(snapshot: Partial<VendorAskSnapshot> = {}) {
  const onSubmit = vi.fn();
  render(
    <AskInput question={question} snapshot={snapshot as VendorAskSnapshot} saving={false} onSubmit={onSubmit} onSkip={() => {}} />,
  );
  return onSubmit;
}

const pick = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "これでええ！" }));

describe("営業時間の入力（10分刻み）", () => {
  it("時と分を選んで、7:30〜13:10 の形で保存する", () => {
    const onSubmit = renderHours();
    pick("開始時間（時）", "7");
    pick("開始時間（分）", "30");
    pick("終了時間（時）", "13");
    pick("終了時間（分）", "10");
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ id: "hours", start: "7:30", end: "13:10" });
  });

  it("分は 00〜50 の10分刻みだけ。時を選ぶまでは分を選べない", () => {
    renderHours();
    const minute = screen.getByLabelText("開始時間（分）") as HTMLSelectElement;
    expect(minute).toBeDisabled();
    pick("開始時間（時）", "9");
    expect([...minute.options].map((o) => o.textContent)).toEqual(["00分", "10分", "20分", "30分", "40分", "50分"]);
  });

  it("24時を選ぶと、分は0分に固定される（24:30 は無い）", () => {
    const onSubmit = renderHours({ businessHoursStart: "7:00" });
    pick("終了時間（時）", "24");
    expect(screen.getByLabelText("終了時間（分）")).toBeDisabled();
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ id: "hours", start: "7:00", end: "24:00" });
  });

  it("これまでの「7:00」の値は、そのまま初期値になる。終わりが始まり以前なら保存できない", () => {
    const onSubmit = renderHours({ businessHoursStart: "7:00", businessHoursEnd: "13:00" });
    expect((screen.getByLabelText("開始時間（時）") as HTMLSelectElement).value).toBe("7");
    expect((screen.getByLabelText("終了時間（時）") as HTMLSelectElement).value).toBe("13");

    pick("終了時間（時）", "7");
    expect(screen.getByText("終わりは、始まりより後にしてや")).toBeInTheDocument();
    submit();
    expect(onSubmit).not.toHaveBeenCalled();

    pick("終了時間（分）", "10");
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ id: "hours", start: "7:00", end: "7:10" });
  });
});

describe("主な商品の入力（名前・写真・値段）", () => {
  const productsQuestion = ASK_QUESTION_BY_ID.get("products")!;
  const renderProducts = (products: VendorAskSnapshot["products"]) => {
    const onSubmit = vi.fn();
    const { container } = render(
      <AskInput question={productsQuestion} snapshot={{ products } as VendorAskSnapshot} saving={false} onSubmit={onSubmit} onSkip={() => {}} />,
    );
    return { onSubmit, container };
  };

  beforeEach(() => {
    // jsdom には画像を読む仕組みが無いので、読めた扱いにする
    vi.spyOn(globalThis, "Image").mockImplementation(function (this: HTMLImageElement) {
      setTimeout(() => this.onload?.(new Event("load")));
      return this;
    } as unknown as typeof Image);
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });

  it("写真を触らなければ、imageFile は渡さない（今の写真のまま）", () => {
    const { onSubmit } = renderProducts([{ name: "トマト", price: 300, imageUrl: "https://example.supabase.co/t.webp" }]);
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ id: "products", items: [{ name: "トマト", price: 300 }] });
  });

  it("保存済みの写真は、×で外すと imageFile: null で渡す", () => {
    const { onSubmit } = renderProducts([{ name: "トマト", price: 300, imageUrl: "https://example.supabase.co/t.webp" }]);
    fireEvent.click(screen.getByRole("button", { name: "トマトの写真を外す" }));
    submit();
    expect(onSubmit).toHaveBeenCalledWith({ id: "products", items: [{ name: "トマト", price: 300, imageFile: null }] });
  });

  it("新しい商品に写真をつけて足すと、名前・値段・写真をまとめて渡す", async () => {
    const { onSubmit, container } = renderProducts([]);
    const file = new File(["x"], "tomato.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByLabelText("商品名"), { target: { value: "トマト" } });
    fireEvent.change(screen.getByLabelText("値段"), { target: { value: "300" } });
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await screen.findByRole("button", { name: "追加する商品の写真を変える" });

    submit();

    expect(onSubmit).toHaveBeenCalledWith({ id: "products", items: [{ name: "トマト", price: 300, imageFile: file }] });
  });
});

describe("店舗写真の入力（全周写真のサムネイルの切り直し）", () => {
  const photoQuestion = ASK_QUESTION_BY_ID.get("shop-photo")!;
  const renderPhoto = (snapshot: Partial<VendorAskSnapshot>) => {
    const onSubmit = vi.fn();
    render(
      <AskInput question={photoQuestion} snapshot={snapshot as VendorAskSnapshot} saving={false} onSubmit={onSubmit} onSkip={() => {}} />,
    );
    return onSubmit;
  };

  it("登録済みの全周写真は、切り取り位置を選び直して、サムネイルだけの答えにできる", () => {
    const onSubmit = renderPhoto({ shopImageUrl: "https://x.supabase.co/v1/store-main.webp?v=1", shopImageKind: "panorama" });

    fireEvent.click(screen.getByRole("button", { name: "サムネイルの切り取り位置を変える" }));
    fireEvent.keyDown(screen.getByRole("slider", { name: "サムネイルにする部分" }), { key: "ArrowRight" });
    submit();

    expect(onSubmit).toHaveBeenCalledWith({
      id: "shop-photo",
      imageFile: null,
      recrop: { sourceUrl: "https://x.supabase.co/v1/store-main.webp?v=1", center: 0.52 },
    });
  });

  it("普通の写真には、切り取り位置を変えるボタンを出さない", () => {
    renderPhoto({ shopImageUrl: "https://x.supabase.co/v1/store-main.webp?v=1", shopImageKind: "normal" });
    expect(screen.queryByRole("button", { name: "サムネイルの切り取り位置を変える" })).toBeNull();
  });
});
