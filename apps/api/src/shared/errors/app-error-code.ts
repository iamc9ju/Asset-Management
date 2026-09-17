export const APP_ERROR_CODE = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  CONFLICT: "CONFLICT",
  UNPROCESSABLE_ENTITY: "UNPROCESSABLE_ENTITY",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  REQUEST_FAILED: "REQUEST_FAILED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_ACCESS_TOKEN_INVALID: "AUTH_ACCESS_TOKEN_INVALID",
  AUTH_ACCESS_TOKEN_EXPIRED: "AUTH_ACCESS_TOKEN_EXPIRED",
  AUTH_SESSION_INVALID: "AUTH_SESSION_INVALID",
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
  AUTH_PERMISSION_DENIED: "AUTH_PERMISSION_DENIED",
  AUTH_RATE_LIMITED: "AUTH_RATE_LIMITED",
} as const;

export type AppErrorCode = (typeof APP_ERROR_CODE)[keyof typeof APP_ERROR_CODE];

export const APP_ERROR_MESSAGE = {
  [APP_ERROR_CODE.VALIDATION_FAILED]: "Request validation failed.",
  [APP_ERROR_CODE.BAD_REQUEST]: "The request is invalid.",
  [APP_ERROR_CODE.UNAUTHORIZED]: "Authentication is required.",
  [APP_ERROR_CODE.FORBIDDEN]:
    "You do not have permission to perform this action.",
  [APP_ERROR_CODE.RESOURCE_NOT_FOUND]: "The requested resource was not found.",
  [APP_ERROR_CODE.CONFLICT]:
    "The request conflicts with the current resource state.",
  [APP_ERROR_CODE.UNPROCESSABLE_ENTITY]: "The request could not be processed.",
  [APP_ERROR_CODE.TOO_MANY_REQUESTS]:
    "Too many requests. Please try again later.",
  [APP_ERROR_CODE.SERVICE_UNAVAILABLE]:
    "The service is temporarily unavailable.",
  [APP_ERROR_CODE.REQUEST_FAILED]: "The request could not be completed.",
  [APP_ERROR_CODE.INTERNAL_ERROR]: "An unexpected error occurred.",
  [APP_ERROR_CODE.AUTH_INVALID_CREDENTIALS]:
    "The email or password is incorrect.",
  [APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID]:
    "The access token is invalid.",
  [APP_ERROR_CODE.AUTH_ACCESS_TOKEN_EXPIRED]:
    "The access token has expired.",
  [APP_ERROR_CODE.AUTH_SESSION_INVALID]:
    "The authentication session is invalid.",
  [APP_ERROR_CODE.AUTH_SESSION_EXPIRED]:
    "The authentication session has expired.",
  [APP_ERROR_CODE.AUTH_PERMISSION_DENIED]:
    "You do not have permission to perform this action.",
  [APP_ERROR_CODE.AUTH_RATE_LIMITED]:
    "Too many authentication attempts. Please try again later.",
} as const satisfies Record<AppErrorCode, string>;
