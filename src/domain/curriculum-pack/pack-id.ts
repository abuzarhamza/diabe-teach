export class PackId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  public static create(raw: string): PackId {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new Error("PackId cannot be empty.");
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
