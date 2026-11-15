import fs from "node:fs/promises";

export async function restoreWorkspaceDirectoryAtomically(
  workspace: string,
  staging: string,
  backup: string,
  persist: () => Promise<void>
) {
  await fs.rename(workspace, backup);
  let stagingInstalled = false;
  try {
    await fs.rename(staging, workspace);
    stagingInstalled = true;
    await persist();
  } catch (error) {
    try {
      if (stagingInstalled) await fs.rm(workspace, { recursive: true, force: true });
      await fs.rename(backup, workspace);
    } catch (rollbackError) {
      throw new Error(
        `Snapshot restore failed: ${error instanceof Error ? error.message : "unknown error"}. Rollback also failed: ${rollbackError instanceof Error ? rollbackError.message : "unknown error"}. The previous workspace remains at ${backup}.`
      );
    }
    throw error;
  }
  await fs.rm(backup, { recursive: true, force: true }).catch(() => undefined);
}
