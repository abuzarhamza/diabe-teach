import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excludes confusing chars: 0, O, I, 1

export class RoomCode {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value.toUpperCase();
    Object.freeze(this);
  }

  public static generate(): RoomCode {
    const bytes = randomBytes(6);
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += ALPHABET[bytes[i]! % ALPHABET.length];
    }
    return new RoomCode(code);
  }

  public static from(value: string): RoomCode {
    return new RoomCode(value.trim().toUpperCase());
  }

  public equals(other: RoomCode): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
