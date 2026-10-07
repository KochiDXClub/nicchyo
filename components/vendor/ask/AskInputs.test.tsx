import { describe, expect, it, vi } from "vitest";
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
