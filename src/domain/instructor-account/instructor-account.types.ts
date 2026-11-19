/** Everything stored for an Instructor Account. Never holds the plain password. */
export interface InstructorAccountProps {
  readonly accountId: string;
  /** Trimmed and lower-cased; unique across accounts. */
  readonly email: string;
  /** An argon2id hash of the password (an encoded PHC string). */
  readonly passwordHash: string;
  /** Wrong passwords in a row since the last successful sign-in. */
  readonly failedSignInCount: number;
  /** While set and in the future, sign-in is refused. */
  readonly lockedUntil: Date | null;
  readonly createdAt: Date;
}

export interface RegisterInstructorAccountInput {
  readonly accountId: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
}
