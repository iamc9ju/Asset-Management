export const API_GLOBAL_PREFIX = "api/v1";

export const API_ROUTE_PARAM = {
  AUTH_SESSION_ID: "sessionId",
} as const;

export const API_ROUTE = {
  AUTH: {
    BASE: "auth",
    LOGIN: "login",
    REFRESH: "refresh",
    LOGOUT: "logout",
    ME: "me",
    SESSIONS: "sessions",
    SESSION_BY_ID: `sessions/:${API_ROUTE_PARAM.AUTH_SESSION_ID}`,
  },
} as const;

export const OPENAPI_ROUTE = {
  UI: "api/docs",
  JSON: "api/docs/openapi.json",
} as const;
