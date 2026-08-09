import { describe, expect, it } from "vitest";
import { EditorAuthTransitionGuard } from "../../packages/app/src/lib/editor-auth-transition";
import { runOwnershipReleasingTransition } from "../../packages/app/src/lib/editor-context-transition";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("editor auth transitions", () => {
  it("retains the accepted user until an account replacement flushes", async () => {
    const flush = deferred<boolean>();
    const guard = new EditorAuthTransitionGuard("alice");
    const transition = guard.transition("bob", () => flush.promise);

    expect(guard.acceptedUserId).toBe("alice");
    flush.resolve(true);

    await expect(transition).resolves.toBe(true);
    expect(guard.acceptedUserId).toBe("bob");
  });

  it("keeps the authenticated user mounted when session expiry cannot flush", async () => {
    const guard = new EditorAuthTransitionGuard("alice");

    await expect(guard.transition(null, async () => false)).resolves.toBe(false);
    expect(guard.acceptedUserId).toBe("alice");
  });

  it("does not commit an auth change that became stale while flushing", async () => {
    const guard = new EditorAuthTransitionGuard("alice");
    const transition = guard.transition as unknown as (
      nextUserId: string | null,
      prepare: () => Promise<boolean>,
      canCommit: () => boolean,
    ) => Promise<boolean>;

    await expect(transition.call(guard, "bob", async () => true, () => false)).resolves.toBe(false);
    expect(guard.acceptedUserId).toBe("alice");
  });

  it("keeps the accepted identity stable when overlapping transitions settle out of order", async () => {
    const firstFlush = deferred<boolean>();
    const secondFlush = deferred<boolean>();
    const guard = new EditorAuthTransitionGuard("alice");
    let firstIsCurrent = true;

    const replacement = guard.transition("bob", () => firstFlush.promise, () => firstIsCurrent);
    firstIsCurrent = false;
    const expiry = guard.transition(null, () => secondFlush.promise);

    firstFlush.resolve(true);
    await expect(replacement).resolves.toBe(false);
    expect(guard.acceptedUserId).toBe("alice");

    secondFlush.resolve(false);
    await expect(expiry).resolves.toBe(false);
    expect(guard.acceptedUserId).toBe("alice");
  });

  it("commits the session captured for the prepared identity", async () => {
    const flush = deferred<boolean>();
    const guard = new EditorAuthTransitionGuard("alice");
    const bob = { user: { id: "bob" } };
    let observedSession: typeof bob | null = bob;
    const transitionSession = observedSession;
    let acceptedSession: typeof bob | null = { user: { id: "alice" } };

    const transition = guard.transition("bob", () => flush.promise, () => {
      acceptedSession = transitionSession;
      return true;
    });
    observedSession = null;
    flush.resolve(true);

    await expect(transition).resolves.toBe(true);
    expect(observedSession).toBeNull();
    expect(acceptedSession?.user.id).toBe("bob");
    expect(guard.acceptedUserId).toBe("bob");
  });

  it("blocks the auth change when editor preparation rejects", async () => {
    const guard = new EditorAuthTransitionGuard("alice");

    await expect(guard.transition(null, async () => {
      throw new Error("recovery storage failed");
    })).resolves.toBe(false);
    expect(guard.acceptedUserId).toBe("alice");
  });
});

describe("ownership-releasing context transitions", () => {
  it("rolls back after ownership was released and committing the new context fails", async () => {
    const events: string[] = [];

    await expect(runOwnershipReleasingTransition({
      prepare: async () => true,
      release: async () => { events.push("release"); },
      commit: async () => {
        events.push("commit");
        throw new Error("persistence failed");
      },
      rollback: async () => { events.push("rollback"); },
    })).rejects.toThrow("persistence failed");

    expect(events).toEqual(["release", "commit", "rollback"]);
  });

  it("does not release ownership when editor preparation is blocked", async () => {
    const events: string[] = [];

    await expect(runOwnershipReleasingTransition({
      prepare: async () => false,
      release: async () => { events.push("release"); },
      commit: async () => { events.push("commit"); },
      rollback: async () => { events.push("rollback"); },
    })).resolves.toBe("blocked");

    expect(events).toEqual([]);
  });
});
