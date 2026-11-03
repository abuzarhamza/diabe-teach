import { randomUUID } from "node:crypto";

export class SessionId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  public static generate(): SessionId {
    return new SessionId(randomUUID());
  }

  public static from(value: string): SessionId {
    return new SessionId(value.trim());
  }

  public equals(other: SessionId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
