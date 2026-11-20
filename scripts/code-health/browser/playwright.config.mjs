import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: ".",
  testMatch: "accessibility.mjs",
  outputDir: "../../../.code-health/accessibility",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: "http://127.0.0.1:3117",
    locale: "ja-JP",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
  },
  projects: [
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3117",
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    port: 3117,
    timeout: 60000,
  },
});
