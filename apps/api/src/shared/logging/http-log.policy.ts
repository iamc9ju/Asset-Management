import type { LevelWithSilent } from "pino";

const WARNING_STATUS_CODES = new Set([400, 401, 403, 409, 422, 429]);

export interface HttpLogPolicyInput {
  readonly statusCode: number;
  readonly isUnknownRoute: boolean;
  readonly isHealthRoute: boolean;
  readonly logHealthRequests: boolean;
}

export function resolveHttpLogLevel({
  statusCode,
  isUnknownRoute,
  isHealthRoute,
  logHealthRequests,
}: HttpLogPolicyInput): LevelWithSilent {
  const isSuccessful = statusCode >= 200 && statusCode < 400;

  if (isHealthRoute && isSuccessful && !logHealthRequests) {
    return "silent";
  }

  if (statusCode >= 500) {
    return "error";
  }

  if (statusCode === 404) {
    return isUnknownRoute ? "info" : "warn";
  }

  if (WARNING_STATUS_CODES.has(statusCode)) {
    return "warn";
  }

  return "info";
}
