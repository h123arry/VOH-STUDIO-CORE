export function compareSnapshotFileHashes(
  snapshotHashes: ReadonlyMap<string, string>,
  currentHashes: ReadonlyMap<string, string>
) {
  const snapshotPaths = [...snapshotHashes.keys()].sort();
  const currentPaths = [...currentHashes.keys()].sort();
  const sharedPaths = currentPaths.filter(filePath => snapshotHashes.has(filePath));
  const changed = sharedPaths.filter(filePath => snapshotHashes.get(filePath) !== currentHashes.get(filePath));
  return {
    added: currentPaths.filter(filePath => !snapshotHashes.has(filePath)),
    removed: snapshotPaths.filter(filePath => !currentHashes.has(filePath)),
    changed,
    unchangedCount: sharedPaths.length - changed.length,
  };
}
