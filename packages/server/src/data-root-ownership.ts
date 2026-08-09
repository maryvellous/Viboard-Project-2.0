import { closeSync, mkdirSync, openSync } from "node:fs";
import { join } from "node:path";
import { flockSync } from "fs-ext";

const LOCK_DIRECTORY = ".desk";
const LOCK_FILE = "writer.lock";

/**
 * Lifetime ownership of a DeskMD data root.
 *
 * The descriptor must remain open: POSIX releases the advisory lock on close or
 * process exit, including crashes. External editors do not honor this lock; it
 * coordinates DeskMD host processes only.
 */
export class DataRootOwnership {
  private constructor(
    readonly root: string,
    private descriptor: number | null,
  ) {}

  static acquire(root: string): DataRootOwnership {
    const lockDirectory = join(root, LOCK_DIRECTORY);
    mkdirSync(lockDirectory, { recursive: true });
    const lockPath = join(lockDirectory, LOCK_FILE);
    const descriptor = openSync(lockPath, "a", 0o600);
    try {
      flockSync(descriptor, "exnb");
      return new DataRootOwnership(root, descriptor);
    } catch (error) {
      closeSync(descriptor);
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `DeskMD data folder is already owned by another process or does not support locking: ${root}. `
        + `Stop the other DeskMD instance and try again. (${detail})`,
      );
    }
  }

  release(): void {
    const descriptor = this.descriptor;
    if (descriptor === null) return;
    this.descriptor = null;
    try {
      flockSync(descriptor, "un");
    } finally {
      closeSync(descriptor);
    }
  }
}
