export const VISUAL_BASE_URL = "http://127.0.0.1:3001";
export const VISUAL_VIEWPORT = { width: 1128, height: 760 };
export const VISUAL_THEMES = /** @type {const} */ (["light", "dark"]);
export const VISUAL_NOW = "2026-07-29T10:30:00+02:00";

export async function openVisualDoc(page) {
  await page.getByRole("treeitem", { name: /website redesign/i }).click({ timeout: 10_000 });
  await page.waitForTimeout(300);
  await page.getByRole("treeitem", { name: "Content Inventory", exact: true }).click({ timeout: 10_000 });
  await page.waitForTimeout(400);
}

export async function openVisualMeeting(page) {
  await page.getByText("Client Kickoff", { exact: true }).click({ timeout: 10_000 });
  await page.waitForTimeout(400);
}

export const VISUAL_PAGES = [
  { name: "dashboard", title: "Dashboard", route: "/" },
  { name: "tasks", title: "Tasks", route: "/tasks" },
  { name: "planner", title: "Planner", route: "/planner" },
  { name: "projects", title: "Projects", route: "/projects?open=website-redesign" },
  { name: "meetings", title: "Meetings", route: "/meetings?open=client-kickoff" },
  { name: "docs", title: "Docs", route: "/docs", prep: openVisualDoc },
];

function localISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function visualPlannerState() {
  const monday = new Date(VISUAL_NOW);
  const mondayOffset = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - mondayOffset);
  const weekOf = localISODate(monday);
  const day = (offset) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + offset);
    return localISODate(date);
  };

  return {
    weekPlans: {
      [weekOf]: {
        weekOf,
        intentions: ["Ship the website refresh", "Prepare the migration dry run"],
        days: {
          [day(0)]: [{ id: "shot-website", workspaceId: "acme", notes: ["Website launch"], taskIds: ["contact-form-endpoint", "analytics-events"], startMinute: 540, endMinute: 690 }],
          [day(1)]: [{ id: "shot-migration", workspaceId: "acme", notes: ["Migration dry run"], taskIds: ["transformation-logic", "id-migration-script"], startMinute: 600, endMinute: 750 }],
          [day(2)]: [{ id: "shot-side-project", workspaceId: "side-projects", notes: ["Pixel Weather"], taskIds: ["location-search"], startMinute: 570, endMinute: 690 }],
          [day(3)]: [{ id: "shot-admin", workspaceId: "personal", notes: ["Admin afternoon"], taskIds: ["quarterly-taxes"], startMinute: 780, endMinute: 900 }],
        },
      },
    },
  };
}

export function visualSeedScript(theme) {
  const boot = { state: { dataPath: "~/DeskMD", setupCompleted: true }, version: 0 };
  const navigation = { state: { currentWorkspaceId: "acme" }, version: 0 };
  const preferences = {
    state: {
      theme,
      sidebarWidth: 224,
      workDayStartHour: 9,
      workDayEndHour: 18,
      showWeekends: false,
      secondarySidebarWidth: 280,
      secondarySidebarCollapsed: false,
      dismissedUpdateVersion: null,
    },
    version: 0,
  };
  const planner = visualPlannerState();

  return `
    localStorage.setItem("desk-boot", ${JSON.stringify(JSON.stringify(boot))});
    localStorage.setItem("desk-navigation", ${JSON.stringify(JSON.stringify(navigation))});
    localStorage.setItem("desk-preferences", ${JSON.stringify(JSON.stringify(preferences))});
    localStorage.setItem("planner-store", ${JSON.stringify(JSON.stringify(planner))});
  `;
}

export async function freezeVisualClock(page) {
  await page.clock.setFixedTime(new Date(VISUAL_NOW));
}

export async function waitForVisualApp(page) {
  await page.waitForSelector("text=Acme Co", { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
}
