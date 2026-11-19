import type { CurriculumPack } from "../../domain/curriculum-pack/curriculum-pack.js";
import semver from "semver";

/** Picks the latest Pack Version (highest semver) among one pack's versions. */
export class PackVersionOrder {
  public static latest<T extends { readonly version: string }>(
    versions: readonly T[],
  ): T | null {
    let latest: T | null = null;
    for (const candidate of versions) {
      if (latest === null || PackVersionOrder.#isNewer(candidate.version, latest.version)) {
        latest = candidate;
      }
    }
    return latest;
  }

  /** The latest version of each pack, in order of each pack's first appearance. */
  public static latestOfEach(
    packs: readonly CurriculumPack[],
  ): CurriculumPack[] {
    const versionsById = new Map<string, CurriculumPack[]>();
    for (const pack of packs) {
      const versions = versionsById.get(pack.id.value) ?? [];
      versions.push(pack);
      versionsById.set(pack.id.value, versions);
    }
    return [
      ...versionsById.values(),
    ]
      .map(versions => PackVersionOrder.latest(versions))
      .filter((pack): pack is CurriculumPack => pack !== null);
  }

  static #isNewer(candidate: string, current: string): boolean {
    const a = semver.valid(candidate);
    const b = semver.valid(current);
    if (a && b) {
      return semver.gt(a, b);
    }
    // A valid semver outranks an invalid one; two invalid versions keep the first.
    return a !== null && b === null;
  }
}
