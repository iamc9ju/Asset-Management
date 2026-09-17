export const AUTH_TOKEN_TYPE = {
  BEARER: "Bearer",
} as const;

export const AUTH_COOKIE = {
  SECURE_REFRESH_TOKEN_NAME: "__Secure-am_refresh",
  DEVELOPMENT_REFRESH_TOKEN_NAME: "am_refresh",
  SAME_SITE: "lax",
} as const;

export const AUTH_CLIENT_METADATA_LIMIT = {
  DEVICE_LABEL_LENGTH: 200,
  USER_AGENT_LENGTH: 1_024,
} as const;

export const AUTH_CREDENTIAL_LIMIT = {
  EMAIL_LENGTH: 320,
  PASSWORD_LENGTH: 1_024,
} as const;
