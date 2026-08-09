import { describe, expect, it } from "vitest";
import { resolveEntityOverviewMode } from "../../packages/app/src/lib/entity-overview-state";

describe("entity overview render state", () => {
  it("never becomes editable before a canonical editor session exists", () => {
    expect(resolveEntityOverviewMode({ hasState: false, isLoading: true, loadError: null, fileDeleted: false }))
      .toBe("loading");
    expect(resolveEntityOverviewMode({ hasState: false, isLoading: false, loadError: new Error("offline"), fileDeleted: false }))
      .toBe("load-error");
    expect(resolveEntityOverviewMode({ hasState: true, isLoading: false, loadError: null, fileDeleted: true }))
      .toBe("missing");
    expect(resolveEntityOverviewMode({ hasState: true, isLoading: false, loadError: null, fileDeleted: false }))
      .toBe("ready");
  });
});
