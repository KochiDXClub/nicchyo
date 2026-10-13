import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VendorCharacterPage from "./page";

describe("お店のキャラクター（モック）", () => {
  it("先頭で「準備中で、保存も申請も届かない」と伝える", () => {
    render(<VendorCharacterPage />);
    expect(screen.getByRole("note")).toHaveTextContent("準備中の画面です");
    expect(screen.getByRole("note")).toHaveTextContent("申請もまだ届きません");
  });

  it("テンプレは10人並び、話し方は変えられないと伝える", () => {
    render(<VendorCharacterPage />);
    const list = screen.getByRole("list", { name: "テンプレキャラ" });
    expect(within(list).getAllByRole("button")).toHaveLength(10);
    expect(screen.getByText(/話し方は変えられません/)).toBeInTheDocument();
  });

  it("テンプレを選んでお店のキャラにすると、「いま答えているキャラ」が変わる", () => {
    render(<VendorCharacterPage />);
    fireEvent.click(screen.getByRole("button", { name: /かつおくん/ }));
    fireEvent.click(screen.getByRole("button", { name: "かつおくんをお店のキャラにする" }));

    expect(screen.getByRole("button", { name: "このキャラを使っています" })).toBeDisabled();
    expect(screen.getByText("いま、お店で答えているキャラ").parentElement).toHaveTextContent("かつおくん");
  });

  it("話し方を試すと返事が返り、残り回数が減る", () => {
    render(<VendorCharacterPage />);
    expect(screen.getByText(/あと100回/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("お客さんになって話しかける"), { target: { value: "おすすめは？" } });
    fireEvent.click(screen.getByRole("button", { name: "送る" }));

    expect(screen.getByText("おすすめは？", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/あと99回/)).toBeInTheDocument();
  });

  it("オリジナルは、イラスト・名前・話し方が揃うまで申請できない", () => {
    render(<VendorCharacterPage />);
    fireEvent.click(screen.getByRole("button", { name: "オリジナルを作る" }));

    expect(screen.getByRole("button", { name: "運営に申請する" })).toBeDisabled();
    expect(screen.getByText(/申請には、イラスト・名前・話し方/)).toBeInTheDocument();
  });

  it("申請→承認でお店のキャラにでき、承認後に内容を直すとまた確認が要る", async () => {
    URL.createObjectURL = () => "blob:illust";
    render(<VendorCharacterPage />);
    fireEvent.click(screen.getByRole("button", { name: "オリジナルを作る" }));

    const file = new File(["x"], "me.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByLabelText("イラストを選ぶ", { selector: "input" }), { target: { files: [file] } });
    });
    fireEvent.change(screen.getByPlaceholderText("例：トマトじいさん"), { target: { value: "トマトじいさん" } });
    fireEvent.change(screen.getByPlaceholderText("例：〜じゃき"), { target: { value: "〜じゃき" } });

    fireEvent.click(screen.getByRole("button", { name: "運営に申請する" }));
    expect(screen.getByRole("button", { name: "運営が確認中です" })).toBeDisabled();
    // 確認の間は、お客さんには出ない
    expect(screen.getByText("いま、お店で答えているキャラ").parentElement).not.toHaveTextContent("トマトじいさん");

    fireEvent.click(screen.getByRole("button", { name: "承認にする" }));
    fireEvent.click(screen.getByRole("button", { name: "お店のキャラにする" }));
    expect(screen.getByText("いま、お店で答えているキャラ").parentElement).toHaveTextContent("トマトじいさん");

    fireEvent.change(screen.getByPlaceholderText("例：トマトじいさん"), { target: { value: "トマトばあさん" } });
    expect(screen.getByText("まだ申請していません。話し方を試して、よければ申請してください。")).toBeInTheDocument();
    // 再確認が済むまでは、承認ずみの内容のまま
    expect(screen.getByText("いま、お店で答えているキャラ").parentElement).toHaveTextContent("トマトじいさん");
  });

  it("差し戻されたら理由が出て、直して申請し直せる", async () => {
    URL.createObjectURL = () => "blob:illust";
    render(<VendorCharacterPage />);
    fireEvent.click(screen.getByRole("button", { name: "オリジナルを作る" }));
    await act(async () => {
      fireEvent.change(screen.getByLabelText("イラストを選ぶ", { selector: "input" }), {
        target: { files: [new File(["x"], "me.png", { type: "image/png" })] },
      });
    });
    fireEvent.change(screen.getByPlaceholderText("例：トマトじいさん"), { target: { value: "トマトじいさん" } });
    fireEvent.change(screen.getByPlaceholderText("例：〜じゃき"), { target: { value: "〜じゃき" } });
    fireEvent.click(screen.getByRole("button", { name: "運営に申請する" }));
    fireEvent.click(screen.getByRole("button", { name: "差し戻しにする" }));

    expect(screen.getByText(/他の方の作品に似ている/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "運営に申請する" })).toBeEnabled();
  });
});
