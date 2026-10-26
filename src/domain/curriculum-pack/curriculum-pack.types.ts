import type { PackId } from "./pack-id.js";

export type AdjacencyRule = "chebyshev-8" | "orthogonal-4";

export interface BoardConfig {
  readonly rows: number;
  readonly cols: number;
  readonly minChainLength: number;
  readonly adjacencyRule: AdjacencyRule;
}

export interface SemanticDomain {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

export interface KeywordCard {
  readonly id: string;
  readonly verbatimLabel: string;
  readonly displayLabel: string;
  readonly aliases: readonly string[];
  readonly domainId: string;
  readonly summary: string;
}

export interface GridCoord {
  readonly row: number;
  readonly col: number;
}

export interface CalibrationExample {
  readonly id: string;
  readonly title: string;
  readonly path: readonly GridCoord[];
  readonly keywordIds: readonly string[];
  readonly narrativeExplanation: string;
  readonly isValid: boolean;
  readonly invalidReason: string | null;
}

export interface AdjudicationRubric {
  readonly evaluatorPersona: string;
  readonly subjectDomain: string;
  readonly chainContinuityCriteria: readonly string[];
  readonly calibrationBoardCardIds?: readonly (readonly string[])[];
  readonly calibrationExamples: readonly CalibrationExample[];
}

export interface AssessmentQuestion {
  readonly id: string;
  readonly bloomLevel: 2 | 3;
  readonly stem: string;
  readonly options: readonly [string, string, string, string];
  readonly correctIndex: 0 | 1 | 2 | 3;
  readonly relatedKeywordIds: readonly string[];
  readonly explanation: string;
}

export interface AssessmentInstrument {
  readonly questions: readonly AssessmentQuestion[];
}

export interface PerceptionSurveyItem {
  readonly id: string;
  readonly prompt: string;
}

export interface PerceptionSurvey {
  readonly items: readonly PerceptionSurveyItem[];
}

export interface CurriculumPackProps {
  readonly id: string | PackId;
  readonly title: string;
  readonly version: string;
  readonly description: string;
  readonly boardConfig: BoardConfig;
  readonly domains: readonly SemanticDomain[];
  readonly cards: readonly KeywordCard[];
  readonly adjudicationRubric: AdjudicationRubric;
  readonly assessmentInstrument: AssessmentInstrument | null;
  readonly perceptionSurvey: PerceptionSurvey | null;
}
