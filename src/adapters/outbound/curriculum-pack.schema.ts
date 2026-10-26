import type { CurriculumPackDocument } from "./mongo-curriculum-pack-repository.types.js";
import { Schema } from "mongoose";

export const DEFAULT_MONGODB_DB_NAME = "diabe_teach";
export const CURRICULUM_PACKS_COLLECTION = "curriculum_packs";
export const CURRICULUM_PACK_MODEL_NAME = "CurriculumPack";

export const curriculumPackSchema = new Schema<CurriculumPackDocument>(
  {
    _id: { type: String, required: true },
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
  },
  {
    collection: CURRICULUM_PACKS_COLLECTION,
    versionKey: false,
  },
);
