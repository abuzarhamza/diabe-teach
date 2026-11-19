import { Schema } from "mongoose";

export const INSTRUCTOR_ACCOUNT_MODEL_NAME = "InstructorAccount";
export const INSTRUCTOR_ACCOUNTS_COLLECTION = "instructor_accounts";

export const instructorAccountSchema = new Schema(
  {
    _id: { type: String, required: true },
    // Normalised (trimmed, lower-cased). The unique index refuses a second
    // account with the same email even when two sign-ups race.
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    failedSignInCount: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, default: null },
    createdAt: { type: Date, required: true },
  },
  {
    collection: INSTRUCTOR_ACCOUNTS_COLLECTION,
    timestamps: false,
    versionKey: false,
  },
);
