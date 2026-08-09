import { describe, expect, it } from "vitest";
import { shouldPreserveTreeMenuActionFocus } from "../../packages/app/src/components/docs/tree-menu-focus";

describe("tree menu close focus", () => {
  it("preserves focus transferred to an element outside the closing menu", () => {
    const body = {} as HTMLElement;
    const input = {} as HTMLElement;
    const menu = { contains: (node: Node | null) => node !== input } as HTMLElement;

    expect(shouldPreserveTreeMenuActionFocus(input, body, menu)).toBe(true);
  });

  it.each(["missing", "body", "inside"] as const)(
    "allows normal restoration for %s focus",
    (state) => {
      const body = {} as HTMLElement;
      const item = {} as HTMLElement;
      const menu = { contains: (node: Node | null) => node === item } as HTMLElement;
      const active = state === "missing" ? null : state === "body" ? body : item;

      expect(shouldPreserveTreeMenuActionFocus(active, body, menu)).toBe(false);
    },
  );
});
