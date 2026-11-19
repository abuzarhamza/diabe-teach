import type { PasswordHasherPort } from "../../application/ports/password-hasher.port.js";
import { hash, verify } from "@node-rs/argon2";

/**
 * argon2id password hashing through `@node-rs/argon2` (prebuilt binaries,
 * ADR-0005). The package's defaults are argon2id with OWASP-recommended cost
 * settings; the encoded hash carries them, so they can be raised later.
 */
export class Argon2PasswordHasher implements PasswordHasherPort {
  public async hash(password: string): Promise<string> {
    return hash(password);
  }

  public async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    }
    catch {
      return false;
    }
  }
}
