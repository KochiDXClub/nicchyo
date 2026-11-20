import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`相談ページ（幅 ${viewport.width}px）`, () => {
    test.use({ viewport, contextOptions: { reducedMotion: "reduce" } });

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

test("スマホで回答を読み進めると話し手は本文と一緒に画面外へ移る", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const reply = "野菜のお店を紹介するね。".repeat(100);
  await page.route("**/api/grandma/ask", (route) => route.fulfill({ json: { reply } }));
  await page.goto("/consult");
  const speaker = page.getByRole("button", { name: /話し手を選ぶ/ });
  await expect(speaker).toBeInViewport();
  const question = page.getByRole("textbox", { name: /への質問/ });
  await question.fill("野菜が買えるお店");
  await question.press("Enter");
  const answer = page.getByText(reply, { exact: true }).first();
  await expect(answer).toBeVisible();
  await answer.hover();
  await page.mouse.wheel(0, 420);
  await expect(speaker).toHaveCount(1);
  await expect(speaker).not.toBeInViewport();
  await expect(answer).toBeInViewport();
});
