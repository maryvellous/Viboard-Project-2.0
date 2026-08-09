interface OwnershipReleasingTransition {
  prepare: () => Promise<boolean>;
  release: () => Promise<void>;
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}

export async function runOwnershipReleasingTransition(
  transition: OwnershipReleasingTransition,
): Promise<"completed" | "blocked"> {
  if (!(await transition.prepare())) return "blocked";
  await transition.release();
  try {
    await transition.commit();
  } catch (error) {
    try {
      await transition.rollback();
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        `Context transition failed and rollback failed: ${String(error)}`,
      );
    }
    throw error;
  }
  return "completed";
}
