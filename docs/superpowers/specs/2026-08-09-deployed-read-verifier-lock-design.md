# Deployed Read Verifier Lock Design

## Problem

The hosted server acquires an exclusive lifetime lock for its data root during `boot()`. The NAS deployment verifier runs as a second process inside the healthy container and also calls `boot()`, so it correctly fails with `EAGAIN` before performing its scoped read.

The deployment itself is healthy. Only the final read verification is incompatible with the ownership contract introduced by commit `181572d`.

## Design

Split server host initialization into two explicit paths:

- Normal server boot configures the Node filesystem host and acquires exclusive data-root ownership for the process lifetime.
- Read-only verification configures the same Node filesystem host without acquiring ownership.

The shared configuration must remain in one internal helper so storage, data-root resolution, and AI-key resolution cannot drift between the two paths. The public `boot()` behavior and return type remain unchanged. The verifier uses the new read-only initialization function and continues to call the existing `verifyDeployedRead()` service-level check.

The read-only path is an intentionally narrow host adapter for this smoke check. It must not be used by the running server, maintenance engine, API process, or any code that writes to the data root.

## Data Flow

1. Docker starts the server process.
2. Server `boot()` acquires `/data/.desk/writer.lock` and configures the Node filesystem host.
3. After public health succeeds, `docker exec` starts the verifier process.
4. The verifier configures read-only access to the mounted root without requesting writer ownership.
5. `verifyDeployedRead()` lists a workspace, project, and document and resolves the same document through its fully scoped identity.
6. The verifier exits after printing the existing JSON success result.

## Error Handling

Data-root validation remains shared, so a missing, relative, or non-directory root still fails immediately. Filesystem and scoped-read mismatches continue to fail the deploy script through its existing non-zero exit behavior. Exclusive-lock failures remain unchanged for every normal `boot()` caller.

Because the verifier reads a live filesystem, a concurrent server write could theoretically make the listing and follow-up read observe different moments. This is acceptable for a deployment smoke check and is no worse than verifying through the live API; the verifier performs no writes.

## Testing

Add an integration-style regression test that:

1. Creates a temporary DeskMD data root with a real scoped document fixture.
2. Acquires `DataRootOwnership` for that root to represent the healthy server.
3. Initializes the verifier's read-only host path while the lock is held.
4. Runs `verifyDeployedRead(getDeskService())` and expects a successful scoped result.
5. Releases the ownership lock during cleanup.

Keep the existing ownership tests unchanged to prove a second normal owner is still rejected. Run the verifier smoke tests, ownership tests, type checking, and the full test suite before completion.

## Non-Goals

- Exposing a new public or unauthenticated HTTP endpoint.
- Weakening or removing server data-root ownership.
- Adding deployment credentials.
- Changing NAS paths, Docker configuration, or health-check semantics.
