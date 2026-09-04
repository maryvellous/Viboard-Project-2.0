import { describe, expect, it } from "vitest";
import { openPaletteRoute } from "../../packages/app/src/lib/search-navigation";

describe("command palette navigation", () => {
  it("activates Desk and navigates after the unsaved-change guard accepts", () => {
    const events: string[] = [];

    const opened = openPaletteRoute("/planner", {
      confirmUnsavedChanges: () => { events.push("confirm"); return true; },
      activateDesk: () => events.push("desk"),
      navigate: (path) => events.push(`navigate:${path}`),
    });

    expect(opened).toBe(true);
    expect(events).toEqual(["confirm", "desk", "navigate:/planner"]);
  });

  it("does nothing when the unsaved-change guard declines", () => {
    const events: string[] = [];

    const opened = openPaletteRoute("/planner", {
      confirmUnsavedChanges: () => false,
      activateDesk: () => events.push("desk"),
      navigate: () => events.push("navigate"),
    });

    expect(opened).toBe(false);
    expect(events).toEqual([]);
  });

  it("runs route-specific preparation after confirmation and before navigation", () => {
    const events: string[] = [];

    const opened = openPaletteRoute("/projects", {
      confirmUnsavedChanges: () => { events.push("confirm"); return true; },
      beforeNavigate: () => events.push("clear-project"),
      activateDesk: () => events.push("desk"),
      navigate: (path) => events.push(`navigate:${path}`),
    });

    expect(opened).toBe(true);
    expect(events).toEqual([
      "confirm",
      "clear-project",
      "desk",
      "navigate:/projects",
    ]);
  });
});
