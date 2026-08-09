# Stable Inline Rename Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep document and folder inline rename active after a tree context menu closes, while routing every commit through Arborist's existing tree-level rename callback.

**Architecture:** Add a small, exported focus-policy function beside the document-tree menu and wire it to Radix's `onCloseAutoFocus`. The policy preserves focus only when an action has already transferred it to a live element outside the closing menu. Replace row-owned rename mutations with `node.submit`, leaving `useDocsTreeActions.handleRename` as the sole document/folder mutation and feedback path.

**Tech Stack:** React 19, TypeScript, Radix Context Menu, react-arborist, Vitest

## Global Constraints

- Scope the focus behavior to document-tree menus; do not alter the shared application context-menu primitive.
- Do not use timers to delay `node.edit()`.
- Preserve Enter, Escape, blur, empty-value, unchanged-value, and duplicate-submission behavior in `InlineRenameInput`.
- Do not alter filenames, remote APIs, tree sorting, selection, or drag-and-drop.
- Add no new test or runtime dependency.

---

### Task 1: Define and enforce document-tree close-focus ownership

**Files:**
- Create: `tests/app/tree-menu-focus.test.ts`
- Modify: `packages/app/src/components/docs/tree-item-menus.tsx:16-48`

**Interfaces:**
- Produces: `shouldPreserveTreeMenuActionFocus(activeElement, documentBody, menuContent): boolean`
- Consumes: Radix `ContextMenuContent`'s `onCloseAutoFocus` event and browser `document.activeElement` / `document.body`

- [ ] **Step 1: Write the failing focus-policy test**

Create table-driven tests with structural fake elements. Assert that focus is preserved when the active element is a live target outside the menu, but not when it is the body, absent, or still inside the menu. The production change that makes this fail is deleting or reversing the outside-focus branch.

```ts
import { describe, expect, it } from "vitest";
import { shouldPreserveTreeMenuActionFocus } from "../../packages/app/src/components/docs/tree-item-menus";

describe("tree menu close focus", () => {
  it("preserves focus transferred to an element outside the closing menu", () => {
    const body = {} as HTMLElement;
    const input = {} as HTMLElement;
    const menu = { contains: (node: Node | null) => node !== input } as HTMLElement;
    expect(shouldPreserveTreeMenuActionFocus(input, body, menu)).toBe(true);
  });

  it.each(["missing", "body", "inside"])("allows normal restoration for %s focus", (state) => {
    const body = {} as HTMLElement;
    const item = {} as HTMLElement;
    const menu = { contains: (node: Node | null) => node === item } as HTMLElement;
    const active = state === "missing" ? null : state === "body" ? body : item;
    expect(shouldPreserveTreeMenuActionFocus(active, body, menu)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- tests/app/tree-menu-focus.test.ts`

Expected: FAIL because `shouldPreserveTreeMenuActionFocus` is not exported.

- [ ] **Step 3: Implement the minimal focus policy and Radix hook**

In `tree-item-menus.tsx`, add the pure policy:

```ts
export function shouldPreserveTreeMenuActionFocus(
  activeElement: Element | null,
  documentBody: HTMLElement,
  menuContent: HTMLElement,
): boolean {
  return activeElement !== null
    && activeElement !== documentBody
    && !menuContent.contains(activeElement);
}
```

Pass an `onCloseAutoFocus` handler to this tree's `ContextMenuContent`. If the policy returns true, call `event.preventDefault()`; otherwise leave Radix's restoration untouched.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- tests/app/tree-menu-focus.test.ts`

Expected: PASS with both focus-policy cases green.

- [ ] **Step 5: Commit the focus regression and fix**

```bash
git add tests/app/tree-menu-focus.test.ts packages/app/src/components/docs/tree-item-menus.tsx
git commit -m "fix(docs): preserve inline rename focus"
```

### Task 2: Consolidate document and folder rename submission

**Files:**
- Modify: `packages/app/src/components/docs/tree/docs-tree-row.tsx:23-38,115-127,223-238`
- Modify: `packages/app/src/components/docs/tree/use-docs-tree-actions.ts:20-31,190-259`

**Interfaces:**
- Consumes: `NodeApi<ArboristNode>.submit(value: string)` and `.reset()`
- Produces: `DocsTreeHandlers` without `onRenameDoc` or `onRenameFolder`; `useDocsTreeActions.handleRename` remains the sole mutation callback passed to `<Tree onRename>`

- [ ] **Step 1: Make the type-level consolidation before implementation**

Remove `onRenameDoc` and `onRenameFolder` from `DocsTreeHandlers`, but leave their row usages temporarily intact.

- [ ] **Step 2: Run typecheck and verify RED**

Run: `npm run typecheck`

Expected: FAIL in `docs-tree-row.tsx` and `use-docs-tree-actions.ts` because the removed duplicate handlers are still read or constructed.

- [ ] **Step 3: Route both row editors through Arborist**

Change both row commit callbacks to call `node.submit(newName)` and retain `node.reset()` for cancellation. Remove the duplicate mutation callbacks from the `handlers` object and remove dependencies that become unused. Do not change the central `handleRename` implementation.

- [ ] **Step 4: Run typecheck and focused tests and verify GREEN**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm test -- tests/app/tree-menu-focus.test.ts tests/app/docs-tree-model.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the rename-pipeline cleanup**

```bash
git add packages/app/src/components/docs/tree/docs-tree-row.tsx packages/app/src/components/docs/tree/use-docs-tree-actions.ts
git commit -m "refactor(docs): use one inline rename pipeline"
```

### Task 3: Full regression verification

**Files:**
- Verify only; modify implementation files only if a command reveals an issue directly caused by Tasks 1-2.

**Interfaces:**
- Consumes: completed focus policy and centralized Arborist rename pipeline
- Produces: verified application build with no unrelated working-tree changes

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: all test files and tests pass with zero failures.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run lint`

Expected: exit 0 with no errors.

- [ ] **Step 3: Build the application**

Run: `npm run build`

Expected: exit 0 and Vite production build completes.

- [ ] **Step 4: Audit the final diff and history**

Run: `git status --short && git diff HEAD~2 --check && git log --oneline -4`

Expected: clean working tree, no whitespace errors, and exactly the two implementation commits after the design/plan documentation commits.
