import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/visual",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      threshold: 0.2,
      maxDiffPixelRatio: 0.015,
    },
  },
  use: {
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 1128, height: 760 },
    locale: "en-US",
    timezoneId: "Europe/Berlin",
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -w @desk/app -- --host 127.0.0.1 --strictPort",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
