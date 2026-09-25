export const LOG_REDACTION_CENSOR = "[REDACTED]" as const;

export const LOG_REDACTION_PATHS = [
  "req.headers.authorization",
  'req.headers["proxy-authorization"]',
  "req.headers.cookie",
  'res.headers["set-cookie"]',

  "password",
  "current_password",
  "new_password",
  "access_token",
  "refresh_token",
  "api_key",
  "access_key",
  "secret_key",

  "POSTGRES_PASSWORD",
  "POSTGRES_URL",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "REDIS_PASSWORD",
  "REDIS_URL",
  "AUTH_RATE_LIMIT_KEY_SECRET",
  "S3_ACCESS_KEY",
  "S3_SECRET_KEY",

  "err.message",
  "err.stack",
  "error.message",
  "error.stack",
] as const;
