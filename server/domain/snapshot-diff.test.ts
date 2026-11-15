import { describe, expect, it } from "vitest";
import { compareSnapshotFileHashes } from "./snapshot-diff";

describe("snapshot content comparison", () => {
  it("distinguishes added, removed, changed, and unchanged files", () => {
    const snapshot = new Map([
      ["src/keep.ts", "same-hash"],
      ["src/change.ts", "old-hash"],
      ["src/remove.ts", "removed-hash"],
    ]);
    const current = new Map([
      ["src/keep.ts", "same-hash"],
      ["src/change.ts", "new-hash"],
      ["src/add.ts", "added-hash"],
    ]);

    expect(compareSnapshotFileHashes(snapshot, current)).toEqual({
      added: ["src/add.ts"],
      removed: ["src/remove.ts"],
      changed: ["src/change.ts"],
      unchangedCount: 1,
    });
  });

  it("returns empty changes for identical snapshots", () => {
    const hashes = new Map([["index.html", "hash"], ["src/app.js", "hash-2"]]);
    expect(compareSnapshotFileHashes(hashes, hashes)).toEqual({
      added: [],
      removed: [],
      changed: [],
      unchangedCount: 2,
    });
  });
});
