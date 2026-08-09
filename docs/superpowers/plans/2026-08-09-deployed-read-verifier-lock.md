# Deployed Read Verifier Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the NAS scoped-read verifier inspect the live data volume without competing for the running server's exclusive writer lock.

**Architecture:** Refactor server host wiring into one internal configuration function. Keep `boot()` as the ownership-acquiring server entry point and add `bootReadOnly()` as the explicit no-ownership entry point used only by the read-only deployment verifier.

**Tech Stack:** TypeScript, Node.js, Vitest, `@desk/core`, `NodeFsProvider`, `fs-ext`.

## Global Constraints

- Normal server `boot()` must continue to acquire and retain exclusive data-root ownership.
- The deployment verifier must not write to the data root.
- Data-root and AI-key configuration must remain shared between normal and read-only initialization.
- No new HTTP endpoint, deployment credential, Docker setting, or NAS path.

---

### Task 1: Reproduce live-lock verification and add read-only initialization

**Files:**
- Modify: `tests/server/deployed-read-smoke.test.ts`
- Modify: `packages/server/src/boot.ts`
- Modify: `scripts/verify-deployed-read.ts`

**Interfaces:**
- Consumes: `DataRootOwnership.acquire(root: string): DataRootOwnership`, `verifyDeployedRead(service: ReadService): Promise<DeployedReadResult>`.
- Produces: `bootReadOnly(): void`; existing `boot(): DataRootOwnership` remains unchanged.

- [ ] **Step 1: Write the failing integration regression test**

Extend `tests/server/deployed-read-smoke.test.ts` with a temporary real data root. Configure the existing `NodeFsProvider` long enough to create one workspace, one project, and one document through `getDeskService()`. Acquire `DataRootOwnership`, point `DESK_DATA_ROOT` at the fixture, call the not-yet-implemented `bootReadOnly()`, and assert this literal result from `verifyDeployedRead(getDeskService())`:

```ts
{
  ok: true,
  workspace: "verification",
  project: "live-data",
  document: created.id,
}
```

Release ownership, restore `DESK_DATA_ROOT`, and remove the temporary root in `finally` cleanup. This test catches the regression where read-only initialization calls `DataRootOwnership.acquire()`.

- [ ] **Step 2: Run the regression test and verify RED**

Run:

```bash
npm test -- --run tests/server/deployed-read-smoke.test.ts
```

Expected: FAIL because `bootReadOnly` is not exported by `packages/server/src/boot.ts`.

- [ ] **Step 3: Implement minimal shared host configuration**

In `packages/server/src/boot.ts`, extract the current configuration after root resolution into a private helper:

```ts
function configureHost(root: string): void {
  setStorage(new NodeFsProvider(root));
  setDataRootResolver(async () => root);
  setAIKeyResolver(async (ref) => keyEnv[ref]?.trim() || null);
}
```

Keep the key map inside the shared helper. Change `boot()` to resolve the root, acquire ownership, call `configureHost(root)`, and return ownership. Add:

```ts
export function bootReadOnly(): void {
  configureHost(resolveDataRoot());
}
```

In `scripts/verify-deployed-read.ts`, import and call `bootReadOnly()` instead of `boot()` in the `isMain` block.

- [ ] **Step 4: Run targeted tests and verify GREEN**

Run:

```bash
npm test -- --run tests/server/deployed-read-smoke.test.ts tests/server/data-root-ownership.test.ts
```

Expected: both files pass; the new verifier test succeeds while ownership is held and the existing second-owner rejection remains green.

- [ ] **Step 5: Run static and full verification**

Run the repository type-check command discovered from `package.json`, followed by:

```bash
npm test
```

Expected: all checks pass without new warnings or errors.

- [ ] **Step 6: Commit the implementation**

Stage only `packages/server/src/boot.ts`, `scripts/verify-deployed-read.ts`, and `tests/server/deployed-read-smoke.test.ts`, preserving all unrelated working-tree changes. Commit with:

```bash
git commit -m "fix(deploy): verify reads without claiming data root"
```
