import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button, buttonClass } from "./button";

describe("buttonClass", () => {
  it("既定は primary / md / pill", () => {
    const c = buttonClass();
    expect(c).toContain("bg-amber-600");
    expect(c).toContain("h-11");
    expect(c).toContain("rounded-chip");
  });

  it("variant ごとに面の指定が変わる", () => {
    expect(buttonClass({ variant: "primary" })).toContain("bg-amber-600");
    expect(buttonClass({ variant: "ink" })).toContain("bg-nicchyo-ink");
    expect(buttonClass({ variant: "secondary" })).toContain("border-amber-200");
    expect(buttonClass({ variant: "quiet" })).toContain("border-line");
    expect(buttonClass({ variant: "ghost" })).toContain("hover:bg-nicchyo-ink/[0.06]");
  });

  it("size ごとに高さが変わる", () => {
    expect(buttonClass({ size: "sm" })).toContain("h-9");
    expect(buttonClass({ size: "md" })).toContain("h-11");
    expect(buttonClass({ size: "lg" })).toContain("h-12");
    expect(buttonClass({ size: "icon" })).toContain("w-10");
  });

  it("shape=soft のときだけ角丸が rounded-btn になる", () => {
    expect(buttonClass({ shape: "pill" })).toContain("rounded-chip");
    const soft = buttonClass({ shape: "soft" });
    expect(soft).toContain("rounded-btn");
    expect(soft).not.toContain("rounded-chip");
  });

  it("指で押せる大きさ(44px)を満たすのは md 以上", () => {
    // 画面の主な操作を sm にしないための歯止め。h-11 = 44px
    expect(buttonClass({ size: "md" })).toContain("h-11");
    expect(buttonClass({ size: "lg" })).toContain("h-12");
  });

  it("reduced motion では拡大縮小を打ち消す", () => {
    const c = buttonClass();
    expect(c).toContain("active:scale-95");
    expect(c).toContain("motion-reduce:active:scale-100");
  });

  it("className は twMerge で後勝ちになる（呼び出し側が面を上書きできる）", () => {
    // 部分一致だと active:bg-amber-600 を拾ってしまうのでクラス単位で見る
    const classes = buttonClass({ variant: "primary", className: "bg-white" }).split(/\s+/);
    expect(classes).toContain("bg-white");
    expect(classes).not.toContain("bg-amber-600");
    // 状態つきの指定（active:）は別物なので残る
    expect(classes).toContain("active:bg-amber-600");
  });
});

describe("Button", () => {
  it("type を指定しなければ button になる（form の中で submit しない）", () => {
    render(<Button>送信しない</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("type は上書きできる", () => {
    render(<Button type="submit">送信</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("onClick が呼ばれる", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>押す</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disabled のとき click が伝わらない", () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        押せない
      </Button>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("ref を転送する", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>参照</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
