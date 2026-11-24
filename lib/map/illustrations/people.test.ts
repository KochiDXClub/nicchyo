import { describe, expect, it } from "vitest";
import { parsePeopleIllustration } from "./people";

const input = {
  name: "来訪者",
  image_url: "/images/maps/people.webp",
  market_id: "45d82c88-155d-40de-8f9e-082928be07d9",
  latitude: 33.56,
  longitude: 133.54,
  width_px: 92,
  enabled: true,
};

describe("人のイラストの表示曜日", () => {
  it("複数の曜日を重複なく曜日順で保存する", () => {
    expect(parsePeopleIllustration({ ...input, weekdays: [4, 0, 4] })).toEqual({ ...input, weekdays: [0, 4] });
  });

  it.each([{ weekdays: [] }, { weekdays: [7] }, { weekdays: [-1] }, { weekdays: ["0"] }, { weekdays: [2.5] }, { weekdays: null }, { weekdays: undefined }])("無効な曜日の指定 $weekdays を拒否する", ({ weekdays }) => {
    expect(parsePeopleIllustration({ ...input, weekdays })).toBe("表示する曜日を1つ以上選んでください");
  });
});
