import type { BoardSeedGeneratorPort } from "../../application/ports/board-randomness.port.js";
import { randomBytes } from "node:crypto";

/** Generates unpredictable board seeds (16 hex characters) from the OS CSPRNG. */
export class CryptoBoardSeedGenerator implements BoardSeedGeneratorPort {
  public nextSeed(): string {
    return randomBytes(8).toString("hex");
  }
}
