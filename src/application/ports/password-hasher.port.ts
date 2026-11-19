/** Hashes and checks Instructor Account passwords (argon2id in production). */
export interface PasswordHasherPort {
  hash: (password: string) => Promise<string>;
  /** False for a wrong password or an unreadable hash; never throws for those. */
  verify: (passwordHash: string, password: string) => Promise<boolean>;
}
