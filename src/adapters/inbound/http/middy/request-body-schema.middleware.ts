import type { MiddlewareObj } from "@middy/core";
import type { ErrorObject, ValidateFunction } from "ajv";
import type { ApiOperationId } from "../request-schemas.generated.js";
import Ajv2020 from "ajv/dist/2020.js";
import { MalformedRequestBodyError } from "../../../../domain/errors/domain-errors.js";
import { requestBodySchemas } from "../request-schemas.generated.js";

/** Longest field path echoed back; a longer one (a huge unknown key) is cut. */
const MAX_FIELD_LENGTH = 120;
const ROOT_FIELD = "body";

/**
 * One Ajv instance for every route, matching the strict compile in
 * tests/request-schemas-generated.test.ts. `format` is not enforced (email
 * validity stays with the domain, which trims and lower-cases first),
 * `useDefaults` stays off so the body is never changed, and the first error
 * is enough for the 400.
 */
const ajv = new Ajv2020({
  strict: true,
  discriminator: true,
  allErrors: false,
  validateFormats: false,
  // Gives each error its `parentSchema`, so a reason can list allowed values.
  verbose: true,
});

const compiled = new Map<ApiOperationId, ValidateFunction>();

function validatorFor(operationId: ApiOperationId): ValidateFunction | undefined {
  if (!(operationId in requestBodySchemas)) {
    return undefined;
  }
  let validate = compiled.get(operationId);
  if (!validate) {
    const entry = requestBodySchemas[operationId as keyof typeof requestBodySchemas];
    validate = ajv.compile(entry.schema as object);
    compiled.set(operationId, validate);
  }
  return validate;
}

/** `/path/0/row` → `path[0].row`; the root is `body`. */
function toFieldPath(pointer: string, child?: string): string {
  const segments = pointer
    .split("/")
    .slice(1)
    .map(segment => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  if (child !== undefined) {
    segments.push(child);
  }
  let field = "";
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      field += `[${segment}]`;
    }
    else {
      field += field === ""
        ? segment
        : `.${segment}`;
    }
  }
  if (field === "") {
    return ROOT_FIELD;
  }
  return field.length > MAX_FIELD_LENGTH
    ? `${field.slice(0, MAX_FIELD_LENGTH)}…`
    : field;
}

function describeValue(value: unknown): string {
  return typeof value === "string"
    ? value
    : JSON.stringify(value);
}

/** The values a schema allows, from `enum`/`const`, through `oneOf`/`anyOf` branches. */
function allowedValues(schema: unknown): unknown[] | undefined {
  if (schema === null || typeof schema !== "object") {
    return undefined;
  }
  const node = schema as Record<string, unknown>;
  if (Array.isArray(node.enum)) {
    return node.enum;
  }
  if ("const" in node) {
    return [node.const];
  }
  const branches = node.oneOf ?? node.anyOf;
  if (Array.isArray(branches)) {
    const values: unknown[] = [];
    for (const branch of branches) {
      const branchValues = allowedValues(branch);
      if (!branchValues) {
        return undefined;
      }
      values.push(...branchValues);
    }
    return values;
  }
  return undefined;
}

function oneOf(values: unknown[]): string {
  return `must be one of: ${values.map(describeValue).join(", ")}`;
}

/** The values a discriminator tag may take, from the `oneOf` branches it picks between. */
function discriminatorValues(parentSchema: unknown, tag: string): unknown[] {
  const branches = (parentSchema as { oneOf?: unknown[] } | undefined)?.oneOf ?? [];
  return branches.flatMap((branch) => {
    const property = (branch as { properties?: Record<string, unknown> }).properties?.[tag];
    return allowedValues(property) ?? [];
  });
}

function typeReason(expected: unknown): string {
  const types = (Array.isArray(expected)
    ? expected
    : [expected]).map(String);
  const named = types.map(type => (type === "null"
    ? "null"
    : type === "integer" || type === "object" || type === "array"
      ? `an ${type}`
      : `a ${type}`));
  return `must be ${named.join(" or ")}`;
}

/**
 * Turns an Ajv error into `{ field, reason }` in our own words. Ajv's
 * messages and error objects are never passed through.
 */
export function describeSchemaError(error: ErrorObject): { field: string; reason: string } {
  const params = error.params as Record<string, unknown>;
  switch (error.keyword) {
    case "required":
      return {
        field: toFieldPath(error.instancePath, String(params.missingProperty)),
        reason: "is required",
      };
    case "additionalProperties":
      return {
        field: toFieldPath(error.instancePath, String(params.additionalProperty)),
        reason: "is not allowed",
      };
    case "discriminator": {
      const tag = String(params.tag);
      const field = toFieldPath(error.instancePath, tag);
      if (params.tagValue === undefined) {
        return { field, reason: "is required" };
      }
      if (typeof params.tagValue !== "string") {
        return { field, reason: "must be a string" };
      }
      return {
        field,
        reason: oneOf(discriminatorValues(error.parentSchema, tag)),
      };
    }
    default:
      break;
  }

  const field = toFieldPath(error.instancePath);
  switch (error.keyword) {
    case "type":
      return {
        field,
        reason: typeReason(params.type),
      };
    case "enum":
    case "const":
    case "oneOf":
    case "anyOf": {
      const values = allowedValues(error.parentSchema);
      return {
        field,
        reason: values
          ? oneOf(values)
          : "does not match any allowed form",
      };
    }
    case "minLength":
      return {
        field,
        reason: params.limit === 1
          ? "must not be empty"
          : `must be at least ${String(params.limit)} characters long`,
      };
    case "maxLength":
      return { field, reason: `must be at most ${String(params.limit)} characters long` };
    case "minItems":
      return { field, reason: `must have at least ${String(params.limit)} item${params.limit === 1
        ? ""
        : "s"}` };
    case "maxItems":
      return { field, reason: `must have at most ${String(params.limit)} items` };
    case "minimum":
      return { field, reason: `must be at least ${String(params.limit)}` };
    case "maximum":
      return { field, reason: `must be at most ${String(params.limit)}` };
    case "exclusiveMinimum":
      return { field, reason: `must be greater than ${String(params.limit)}` };
    case "exclusiveMaximum":
      return { field, reason: `must be less than ${String(params.limit)}` };
    default:
      return { field, reason: "is not valid" };
  }
}

/**
 * Checks the parsed body against the route's request schema, generated from
 * docs/api/openapi.yaml (api-hardening 05/06). A body that breaks it is 400
 * `INVALID_REQUEST_BODY` with `details.field` (the path of the first failing
 * field, like `path[0].row`) and `details.reason`.
 *
 * A route whose operation has no request body skips this step. A request
 * with no body is checked as `{}`, so a missing required field is named.
 *
 * Runs after `authMiddleware` (401 first) and `jsonObjectBodyMiddleware`
 * (the body is already a JSON object). Domain rules keep their own codes.
 */
export function requestBodySchemaMiddleware(operationId: ApiOperationId): MiddlewareObj<any, any> {
  const validate = validatorFor(operationId);
  return {
    before: async (request) => {
      if (!validate) {
        return;
      }
      const body: unknown = request.event.body ?? {};
      if (validate(body)) {
        return;
      }
      // Ajv stops at the first failure; when it fails inside `oneOf`, the
      // branch errors come first and the `oneOf` error itself is last.
      const errors = validate.errors ?? [];
      const last = errors[errors.length - 1];
      const { field, reason } = last
        ? describeSchemaError(last)
        : { field: ROOT_FIELD, reason: "is not valid" };
      throw new MalformedRequestBodyError(`Invalid request body: '${field}' ${reason}.`, { field, reason });
    },
  };
}
