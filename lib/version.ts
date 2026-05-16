// Source of truth for the running release + the minimum-supported client.
//
// APP_VERSION is the version that built this bundle. Baked at compile time
// (no runtime fetch), so it's instantly available to the client without a
// network roundtrip. Mirror package.json on every release.
//
// MIN_CLIENT_VERSION is the floor: clients older than this MUST refresh
// before the server will trust their writes. Surfaced via /api/version
// so the client can hard-prompt a reload on mismatch. Update this only
// when you ship a release that genuinely breaks older clients (schema
// migration that drops a column those clients still write, RPC contract
// change, etc.).
//
// On a routine release where older clients keep working, leave the floor
// alone. Bumping it kicks every offline-queued write on older devices.

export const APP_VERSION = "1.45.3";
export const MIN_CLIENT_VERSION = "1.34.0";

/**
 * Strict semver compare for the "X.Y.Z" shape we use (no pre-release tags).
 * Returns negative if a < b, 0 if equal, positive if a > b.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
