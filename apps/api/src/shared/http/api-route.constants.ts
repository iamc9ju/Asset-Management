export const API_GLOBAL_PREFIX = "api/v1";

export const API_ROUTE = {
  AUTH: {
    BASE: "auth",
    LOGIN: "login",
    REFRESH: "refresh",
    ME: "me",
  },
} as const;

export const OPENAPI_ROUTE = {
  UI: "api/docs",
  JSON: "api/docs/openapi.json",
} as const;
