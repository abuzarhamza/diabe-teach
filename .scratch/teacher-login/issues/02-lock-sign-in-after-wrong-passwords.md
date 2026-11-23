# 02: Sign-in locks for 15 minutes after five wrong passwords

**What to build:** After **five wrong passwords in a row**, an Instructor Account is locked for **15 minutes**. While it's locked, every sign-in attempt, even with the right password, gets a distinct "temporarily locked, try again later" error, not the generic 401. A successful sign-in resets the count. The count and lock-until time are kept on the Instructor Account record (no extra collection), and the domain decides using the existing clock port, not `new Date()`. Unknown emails don't create records or counters.

See spec: `.scratch/teacher-login/spec.md`.

**Blocked by:** 01 (Teachers sign up and sign in with an email and password)

**Status:** resolved

- [x] Handler test: four wrong passwords and then the right one signs in, and the count resets
- [x] Handler test: five wrong passwords lock the account; the right password then gets the "locked" error
- [x] Handler test: once the clock passes 15 minutes, the right password signs in again
- [x] Handler test: wrong passwords for an unknown email still return the generic 401 and create nothing
- [x] Repository contract suite (in-memory + Mongo): the failed-attempt count and lock-until time round-trip
- [x] OpenAPI documents the "locked" error on sign-in
- [x] Typecheck, vitest, BDD (one feature at a time), lint and boundaries are no worse

## Resolution (2026-11-19)

Sign-in returns **423 `ACCOUNT_TEMPORARILY_LOCKED`** (with `details.lockedUntil`) while locked; the fifth wrong password itself gets it. `InstructorAccount` decides (`activeLockEnd`, `recordFailedSignIn`, `recordSuccessfulSignIn`) from `ClockPort`; locking resets the count, so another lock needs five fresh wrong passwords. Attempts while locked do not extend the lock. The repository port gained `saveSignInCounters` (in-memory and Mongo `$set` of the two fields). Concurrent wrong passwords can undercount (read-modify-write, no atomic `$inc`), accepted for the PoC. No new BDD scenario: the lock is covered at the handler seam.
