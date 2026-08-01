import { expect, test } from "@playwright/test";
import {
  VISUAL_PAGES,
  VISUAL_THEMES,
  freezeVisualClock,
  visualSeedScript,
  waitForVisualApp,
} from "../../scripts/ui-visual-fixture.mjs";

for (const theme of VISUAL_THEMES) {
  test.describe(`${theme} UI`, () => {
    test.use({ colorScheme: theme });

    for (const shot of VISUAL_PAGES) {
      test(shot.name, async ({ page }) => {
        await page.addInitScript(visualSeedScript(theme));
        await freezeVisualClock(page);
        await page.goto(shot.route, { waitUntil: "domcontentloaded" });
        await waitForVisualApp(page);
        if (shot.prep) await shot.prep(page);
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${shot.name}-${theme}.png`);
      });
    }
  });
}

test("workspace page chrome remains usable at 960px", async ({ browser }) => {
  const pages = VISUAL_PAGES.filter(({ name }) =>
    ["dashboard", "tasks", "planner", "projects"].includes(name),
  );

  for (const shot of pages) {
    const context = await browser.newContext({
      viewport: { width: 960, height: 700 },
      locale: "en-US",
      timezoneId: "Europe/Berlin",
      reducedMotion: "reduce",
    });
    await context.addInitScript(visualSeedScript("light"));
    const page = await context.newPage();
    await freezeVisualClock(page);
    const route = shot.name === "projects" ? "/projects" : shot.route;
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await waitForVisualApp(page);

    await expect(page.getByRole("heading", { level: 1, name: shot.title }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    if (shot.name === "tasks") await expect(page.getByRole("button", { name: /new task/i })).toBeVisible();
    if (shot.name === "projects") await expect(page.getByRole("button", { name: /new project/i })).toBeVisible();
    await context.close();
  }
});
