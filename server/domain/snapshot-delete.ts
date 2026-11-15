import fs from "node:fs/promises";

export async function deleteSnapshotDirectoryAtomically(
  source: string,
  tombstone: string,
  persist: () => Promise<void>
) {
  await fs.rename(source, tombstone);
  try {
    await persist();
  } catch (error) {
    try {
      await fs.rename(tombstone, source);
    } catch (rollbackError) {
      throw new Error(
        `Snapshot deletion failed: ${error instanceof Error ? error.message : "unknown error"}. Rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : "unknown error"}. The snapshot remains at ${tombstone}.`
      );
    }
    throw error;
  }
  await fs.rm(tombstone, { recursive: true, force: true }).catch(() => undefined);
}
