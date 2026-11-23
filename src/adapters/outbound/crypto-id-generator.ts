import type { IdGeneratorPort } from "../../application/ports/id-generator.port.js";
import { randomUUID } from "node:crypto";

export class CryptoIdGenerator implements IdGeneratorPort {
  public generate(): string {
    return randomUUID();
  }
}
