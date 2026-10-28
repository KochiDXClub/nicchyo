import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import enUi from "@/content/i18n/ui.en.json";
import { translate } from "./translate";

describe("translate", () => {
  test("訳があれば訳を、無ければ日本語の原文を返す", () => {
    expect(translate("en", "お気に入り")).toBe("Favorites");
    expect(translate("en", "辞書に無い文言")).toBe("辞書に無い文言");
    expect(translate("ja", "お気に入り")).toBe("お気に入り");
  });
});

/** t("日本語") の形で書かれた文言が、すべて英語の辞書にあること（訳の入れ忘れを防ぐ） */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name.startsWith(".")) return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("英語の辞書", () => {
  test("t(\"…\") で使っている日本語がすべて載っている", () => {
    const root = process.cwd();
    const used = new Set<string>();
    for (const dir of ["app", "components", "lib"]) {
      for (const file of sourceFiles(join(root, dir))) {
        const text = readFileSync(file, "utf8");
        if (!/useT\(|getT\(/.test(text)) continue;
        for (const match of text.matchAll(/\bt\(\s*(?:"([^"]*[ぁ-んァ-ン一-龥][^"]*)"|'([^']*[ぁ-んァ-ン一-龥][^']*)')\s*\)/g)) {
          used.add(match[1] ?? match[2]);
        }
      }
    }
    expect(used.size).toBeGreaterThan(20);
    const missing = [...used].filter((key) => !(key in enUi));
    expect(missing).toEqual([]);
  });
});

describe("店舗の選択肢の固定訳", () => {
  test("運営が定義したすべての選択肢に英訳がある", async () => {
    const { RAIN_OPTIONS, PAYMENT_OPTIONS, STYLE_PRESETS, WEEKDAY_OPTIONS } = await import("@/lib/vendor/storeOptions");
    const labels = [...RAIN_OPTIONS.map(({ label }) => label), ...PAYMENT_OPTIONS.map(({ label }) => label), ...STYLE_PRESETS, ...WEEKDAY_OPTIONS];
    expect(labels.filter((label) => !(label in enUi))).toEqual([]);
    for (const label of labels) expect(translate("ja", label)).toBe(label);
  });
});
