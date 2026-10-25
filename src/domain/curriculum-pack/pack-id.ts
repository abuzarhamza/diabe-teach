import { PackNotFoundError } from "../errors/domain-errors.js";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export class PackId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  public static create(raw: string): PackId {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || !SLUG_PATTERN.test(trimmed)) {
      throw new PackNotFoundError(raw);
    }
    return new PackId(trimmed);
  }

  public equals(other: PackId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
