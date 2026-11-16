import { t } from "elysia";
import { ApiError } from "./http";

// Public ids are BIGINT values carried as decimal strings (not safe as JSON numbers).
export const ID_PATTERN = /^[1-9][0-9]{0,18}$/;
export const idSchema = t.String({ pattern: ID_PATTERN.source });
const MAX_BIGINT = 9223372036854775807n;

export function parseId(value: string): bigint {
  if (!ID_PATTERN.test(value) || BigInt(value) > MAX_BIGINT) throw new ApiError(422, "VALIDATION_ERROR", "Expected a positive BIGINT string");
  return BigInt(value);
}
