import type {
  BoardConfig,
  CurriculumPackProps,
  KeywordCard,
  SemanticDomain,
} from "../../domain/curriculum-pack/curriculum-pack.types.js";
import type {
  ValidationError,
  ValidationWarning,
} from "../ports/validate-curriculum-pack.port.js";

type PackInput = Omit<
  CurriculumPackProps,
  "id" | "isSystemPack" | "isArchived" | "createdBy" | "authorName" | "createdAt" | "archivedAt"
> & { readonly id: string };

export interface PackValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ValidationError[];
  readonly warnings: readonly ValidationWarning[];
}

const PACK_ID_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export class PackValidator {
  public static validate(pack: PackInput): PackValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    PackValidator.#validateSchema(pack, errors);
    PackValidator.#validateSemantics(pack, errors);
    PackValidator.#validateCalibration(pack, errors);
    PackValidator.#checkOptionalFields(pack, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static #validateSchema(pack: PackInput, errors: ValidationError[]): void {
    if (!pack.id || typeof pack.id !== "string") {
      errors.push({
        path: "id",
        code: "REQUIRED_FIELD",
        message: "Pack id is required.",
      });
    }
    else if (!PACK_ID_PATTERN.test(pack.id)) {
      errors.push({
        path: "id",
        code: "INVALID_PACK_ID",
        message: "Pack id must be a lowercase slug (e.g., 'my-pack-name').",
      });
    }

    if (!pack.title || typeof pack.title !== "string") {
      errors.push({
        path: "title",
        code: "REQUIRED_FIELD",
        message: "Pack title is required.",
      });
    }

    if (!pack.version || typeof pack.version !== "string") {
      errors.push({
        path: "version",
        code: "REQUIRED_FIELD",
        message: "Pack version is required.",
      });
    }
    else if (!VERSION_PATTERN.test(pack.version)) {
      errors.push({
        path: "version",
        code: "INVALID_VERSION",
        message: "Version must follow semver format (e.g., '1.0.0').",
      });
    }

    if (!pack.description || typeof pack.description !== "string") {
      errors.push({
        path: "description",
        code: "REQUIRED_FIELD",
        message: "Pack description is required.",
      });
    }

    PackValidator.#validateBoardConfig(pack.boardConfig, errors);
    PackValidator.#validateDomains(pack.domains, errors);
    PackValidator.#validateCards(pack.cards, errors);
    PackValidator.#validateAdjudicationRubric(pack, errors);
  }

  static #validateBoardConfig(
    config: BoardConfig | undefined | null,
    errors: ValidationError[],
  ): void {
    if (!config) {
      errors.push({
        path: "boardConfig",
        code: "REQUIRED_FIELD",
        message: "Board configuration is required.",
      });
      return;
    }

    if (typeof config.rows !== "number" || config.rows < 1) {
      errors.push({
        path: "boardConfig.rows",
        code: "INVALID_VALUE",
        message: "Board rows must be a positive integer.",
      });
    }

    if (typeof config.cols !== "number" || config.cols < 1) {
      errors.push({
        path: "boardConfig.cols",
        code: "INVALID_VALUE",
        message: "Board cols must be a positive integer.",
      });
    }

    if (typeof config.minChainLength !== "number" || config.minChainLength < 2) {
      errors.push({
        path: "boardConfig.minChainLength",
        code: "INVALID_VALUE",
        message: "Minimum chain length must be at least 2.",
      });
    }

    if (!["chebyshev-8", "orthogonal-4"].includes(config.adjacencyRule)) {
      errors.push({
        path: "boardConfig.adjacencyRule",
        code: "INVALID_VALUE",
        message: "Adjacency rule must be 'chebyshev-8' or 'orthogonal-4'.",
      });
    }
  }

  static #validateDomains(
    domains: readonly SemanticDomain[] | undefined | null,
    errors: ValidationError[],
  ): void {
    if (!domains || !Array.isArray(domains)) {
      errors.push({
        path: "domains",
        code: "REQUIRED_FIELD",
        message: "Domains array is required.",
      });
      return;
    }

    if (domains.length === 0) {
      errors.push({
        path: "domains",
        code: "ARRAY_MIN_LENGTH",
        message: "At least one domain is required.",
      });
    }

    const seenIds = new Set<string>();
    domains.forEach((domain, index) => {
      if (!domain.id) {
        errors.push({
          path: `domains[${index}].id`,
          code: "REQUIRED_FIELD",
          message: `Domain at index ${index} must have an id.`,
        });
      }
      else if (seenIds.has(domain.id)) {
        errors.push({
          path: `domains[${index}].id`,
          code: "DUPLICATE_ID",
          message: `Domain id '${domain.id}' is duplicated.`,
        });
      }
      else {
        seenIds.add(domain.id);
      }

      if (!domain.label) {
        errors.push({
          path: `domains[${index}].label`,
          code: "REQUIRED_FIELD",
          message: `Domain at index ${index} must have a label.`,
        });
      }
    });
  }

  static #validateCards(
    cards: readonly KeywordCard[] | undefined | null,
    errors: ValidationError[],
  ): void {
    if (!cards || !Array.isArray(cards)) {
      errors.push({
        path: "cards",
        code: "REQUIRED_FIELD",
        message: "Cards array is required.",
      });
      return;
    }

    if (cards.length === 0) {
      errors.push({
        path: "cards",
        code: "ARRAY_MIN_LENGTH",
        message: "At least one card is required.",
      });
    }

    const seenIds = new Set<string>();
    cards.forEach((card, index) => {
      if (!card.id) {
        errors.push({
          path: `cards[${index}].id`,
          code: "REQUIRED_FIELD",
          message: `Card at index ${index} must have an id.`,
        });
      }
      else if (seenIds.has(card.id)) {
        errors.push({
          path: `cards[${index}].id`,
          code: "DUPLICATE_ID",
          message: `Card id '${card.id}' is duplicated.`,
        });
      }
      else {
        seenIds.add(card.id);
      }

      if (!card.verbatimLabel) {
        errors.push({
          path: `cards[${index}].verbatimLabel`,
          code: "REQUIRED_FIELD",
          message: `Card at index ${index} must have a verbatimLabel.`,
        });
      }

      if (!card.domainId) {
        errors.push({
          path: `cards[${index}].domainId`,
          code: "REQUIRED_FIELD",
          message: `Card at index ${index} must have a domainId.`,
        });
      }
    });
  }

  static #validateAdjudicationRubric(
    pack: PackInput,
    errors: ValidationError[],
  ): void {
    const rubric = pack.adjudicationRubric;
    if (!rubric) {
      errors.push({
        path: "adjudicationRubric",
        code: "REQUIRED_FIELD",
        message: "Adjudication rubric is required.",
      });
      return;
    }

    if (!rubric.evaluatorPersona) {
      errors.push({
        path: "adjudicationRubric.evaluatorPersona",
        code: "REQUIRED_FIELD",
        message: "Evaluator persona is required.",
      });
    }

    if (!rubric.subjectDomain) {
      errors.push({
        path: "adjudicationRubric.subjectDomain",
        code: "REQUIRED_FIELD",
        message: "Subject domain is required.",
      });
    }

    if (
      !rubric.chainContinuityCriteria
      || rubric.chainContinuityCriteria.length === 0
    ) {
      errors.push({
        path: "adjudicationRubric.chainContinuityCriteria",
        code: "ARRAY_MIN_LENGTH",
        message: "At least one chain continuity criterion is required.",
      });
    }
  }

  static #validateSemantics(pack: PackInput, errors: ValidationError[]): void {
    if (!pack.domains || !pack.cards)
      return;

    const domainIds = new Set(pack.domains.map(d => d.id));

    pack.cards.forEach((card, index) => {
      if (card.domainId && !domainIds.has(card.domainId)) {
        errors.push({
          path: `cards[${index}].domainId`,
          code: "INVALID_DOMAIN_REF",
          message: `Card '${card.id}' references unknown domain '${card.domainId}'.`,
        });
      }
    });
  }

  static #validateCalibration(pack: PackInput, errors: ValidationError[]): void {
    if (!pack.adjudicationRubric?.calibrationBoardCardIds || !pack.boardConfig)
      return;

    const { rows, cols } = pack.boardConfig;
    const calibrationBoard = pack.adjudicationRubric.calibrationBoardCardIds;

    if (calibrationBoard.length !== rows) {
      errors.push({
        path: "adjudicationRubric.calibrationBoardCardIds",
        code: "DIMENSION_MISMATCH",
        message: `Calibration board has ${calibrationBoard.length} rows but boardConfig specifies ${rows} rows.`,
      });
    }

    calibrationBoard.forEach((row, rowIndex) => {
      if (row.length !== cols) {
        errors.push({
          path: `adjudicationRubric.calibrationBoardCardIds[${rowIndex}]`,
          code: "DIMENSION_MISMATCH",
          message: `Calibration board row ${rowIndex} has ${row.length} columns but boardConfig specifies ${cols} columns.`,
        });
      }
    });

    const cardIds = new Set(pack.cards?.map(c => c.id) ?? []);
    calibrationBoard.forEach((row, rowIndex) => {
      row.forEach((cardId, colIndex) => {
        if (!cardIds.has(cardId)) {
          errors.push({
            path: `adjudicationRubric.calibrationBoardCardIds[${rowIndex}][${colIndex}]`,
            code: "INVALID_CARD_REF",
            message: `Calibration board references unknown card '${cardId}'.`,
          });
        }
      });
    });
  }

  static #checkOptionalFields(pack: PackInput, warnings: ValidationWarning[]): void {
    if (!pack.assessmentInstrument) {
      warnings.push({
        path: "assessmentInstrument",
        code: "OPTIONAL_FIELD_MISSING",
        message: "Assessment instrument is not provided. Pre/post tests will not be available.",
      });
    }

    if (!pack.perceptionSurvey) {
      warnings.push({
        path: "perceptionSurvey",
        code: "OPTIONAL_FIELD_MISSING",
        message: "Perception survey is not provided. Post-session surveys will not be available.",
      });
    }

    if (!pack.adjudicationRubric?.calibrationExamples?.length) {
      warnings.push({
        path: "adjudicationRubric.calibrationExamples",
        code: "OPTIONAL_FIELD_MISSING",
        message: "No calibration examples provided. AI adjudication accuracy may be reduced.",
      });
    }
  }
}
