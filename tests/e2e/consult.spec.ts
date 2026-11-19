import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`相談ページ（幅 ${viewport.width}px）`, () => {
    test.use({ viewport, reducedMotion: "reduce" });

    test("話し手を選ぶ画面をキーボードで閉じ、元のボタンに戻れる", async ({ page }) => {
      await page.goto("/consult");
      const opener = page.getByRole("button", { name: /話し手を選ぶ/ }).first();
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "だれに聞く？" });
      const close = dialog.getByRole("button", { name: "閉じる" });
      await expect(close).toBeFocused();
      const bounds = await close.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    });
  });
}
