import type { CurriculumPackDocument } from "./mongo-curriculum-pack-repository.types.js";
import { Schema } from "mongoose";

export const DEFAULT_MONGODB_DB_NAME = "diabe_teach";
export const CURRICULUM_PACKS_COLLECTION = "curriculum_packs";
export const CURRICULUM_PACK_MODEL_NAME = "CurriculumPack";

export const curriculumPackSchema = new Schema<CurriculumPackDocument>(
  {
    // `<packId>@<version>` for versions registered since version lookup
    // existed; the bare pack id for older documents and seeded System Packs.
    _id: { type: String, required: true },
    // Absent on older documents, whose `_id` is the pack id.
    packId: { type: String, index: true },
    title: { type: String, required: true },
    version: { type: String, required: true },
    description: { type: String },
    boardConfig: { type: Schema.Types.Mixed, required: true },
    domains: {
      type: [Schema.Types.Mixed],
      required: true,
    },
    cards: {
      type: [Schema.Types.Mixed],
      required: true,
    },
    adjudicationRubric: { type: Schema.Types.Mixed, required: true },
    assessmentInstrument: { type: Schema.Types.Mixed },
    perceptionSurvey: { type: Schema.Types.Mixed },
    isSystemPack: { type: Boolean, required: true, default: false },
    isArchived: { type: Boolean, required: true, default: false },
    // The releasing Instructor Account's id (ADR-0007); older Pack Versions
    // keep the instructor session id they were registered with.
    createdBy: { type: String, default: null },
    authorName: { type: String, default: null },
    createdAt: { type: Date, required: true, default: Date.now },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: String, default: null },
    unarchivedAt: { type: Date, default: null },
    unarchivedBy: { type: String, default: null },
  },
  {
    collection: CURRICULUM_PACKS_COLLECTION,
    versionKey: false,
  },
);
