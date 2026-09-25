import { environmentSchema, validateEnvironment } from "./environment.schema";

const VALID_ENVIRONMENT = {
  NODE_ENV: "development",
  WEB_ORIGIN: "http://localhost:5173",
  AUTH_JWT_ISSUER: "asset-management-api",
  AUTH_JWT_AUDIENCE: "asset-management-web",
  AUTH_JWT_CURRENT_KID: "v1",
  AUTH_JWT_CURRENT_SECRET:
    "test-signing-secret-with-at-least-256-bits-of-entropy-value",
  AUTH_RATE_LIMIT_KEY_SECRET:
    "test-rate-limit-secret-with-at-least-256-bits-of-entropy",
  AUTH_RATE_LIMIT_NAMESPACE: "asset-management-test",
  AUTH_REFRESH_COOKIE_SECURE: "true",
  DATABASE_URL:
    "postgresql://database-user:secure-database-password@example.neon.tech/database?sslmode=verify-full&channel_binding=require",
  REDIS_URL: "redis://localhost:6379",
  S3_ENDPOINT: "http://localhost:8333",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY: "asset-local",
  S3_SECRET_KEY: "secure-storage-secret",
  S3_BUCKET: "asset-files",
} as const;

describe("environmentSchema", () => {
  it("parses explicitly configured logging values", () => {
    const result = environmentSchema.parse({
      ...VALID_ENVIRONMENT,
      LOG_LEVEL: "debug",
      LOG_PRETTY: "true",
      LOG_HEALTH_REQUESTS: "false",
    });

    expect(result.LOG_LEVEL).toBe("debug");
    expect(result.LOG_PRETTY).toBe(true);
    expect(result.LOG_HEALTH_REQUESTS).toBe(false);
  });

  it("parses Neon database configuration", () => {
    const result = environmentSchema.parse({
      ...VALID_ENVIRONMENT,
      DATABASE_URL_UNPOOLED:
        "postgresql://database-user:secure-database-password@example.neon.tech/database?sslmode=verify-full&channel_binding=require",
      DATABASE_POOL_SIZE: "5",
    });

    expect(result.DATABASE_POOL_SIZE).toBe(5);
    expect(result.DATABASE_URL_UNPOOLED).toContain("postgresql://");
  });

  it("parses authentication defaults", () => {
    const result = environmentSchema.parse({
      ...VALID_ENVIRONMENT,
      AUTH_REFRESH_COOKIE_SECURE: "false",
    });

    expect(result.AUTH_ACCESS_TOKEN_TTL_SECONDS).toBe(900);
    expect(result.AUTH_SESSION_IDLE_TTL_SECONDS).toBe(604_800);
    expect(result.AUTH_SESSION_ABSOLUTE_TTL_SECONDS).toBe(2_592_000);
    expect(result.AUTH_LOGIN_RATE_LIMIT).toBe(10);
    expect(result.AUTH_LOGIN_IP_RATE_LIMIT).toBe(100);
    expect(result.AUTH_REFRESH_RATE_LIMIT).toBe(30);
    expect(result.AUTH_REFRESH_IP_RATE_LIMIT).toBe(300);
    expect(result.AUTH_SESSION_RETENTION_SECONDS).toBe(2_592_000);
    expect(result.AUTH_CLEANUP_BATCH_SIZE).toBe(500);
    expect(result.AUTH_CLEANUP_MAX_BATCHES).toBe(20);
    expect(result.HTTP_TRUST_PROXY_HOPS).toBe(0);
    expect(result.AUTH_REFRESH_COOKIE_SECURE).toBe(false);
  });

  it("requires WEB_ORIGIN to be an exact HTTP origin", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        WEB_ORIGIN: "https://app.example.com/path",
      }),
    ).toThrow(/Environment validation failed: WEB_ORIGIN:/);

    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        WEB_ORIGIN: "https://app.example.com/",
      }),
    ).toThrow(/Environment validation failed: WEB_ORIGIN:/);
  });

  it("disables OpenAPI endpoints by default", () => {
    const result = environmentSchema.parse(VALID_ENVIRONMENT);

    expect(result.OPENAPI_ENABLED).toBe(false);
    expect(result.OPENAPI_UI_ENABLED).toBe(false);
  });

  it("parses explicitly enabled OpenAPI endpoints", () => {
    const result = environmentSchema.parse({
      ...VALID_ENVIRONMENT,
      OPENAPI_ENABLED: "true",
      OPENAPI_UI_ENABLED: "true",
    });

    expect(result.OPENAPI_ENABLED).toBe(true);
    expect(result.OPENAPI_UI_ENABLED).toBe(true);
  });

  it("rejects an enabled OpenAPI UI when OpenAPI is disabled", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        OPENAPI_ENABLED: "false",
        OPENAPI_UI_ENABLED: "true",
      }),
    ).toThrow(
      /Environment validation failed: OPENAPI_UI_ENABLED: cannot be true when OPENAPI_ENABLED is false/,
    );
  });

  it("rejects a short JWT signing secret", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        AUTH_JWT_CURRENT_SECRET: "too-short",
      }),
    ).toThrow(/Environment validation failed: AUTH_JWT_CURRENT_SECRET:/);
  });

  it("rejects a short authentication rate-limit key secret", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        AUTH_RATE_LIMIT_KEY_SECRET: "too-short",
      }),
    ).toThrow(/Environment validation failed: AUTH_RATE_LIMIT_KEY_SECRET:/);
  });

  it("rejects the development rate-limit namespace in production", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        NODE_ENV: "production",
        AUTH_RATE_LIMIT_NAMESPACE: "asset-management-development",
      }),
    ).toThrow(/AUTH_RATE_LIMIT_NAMESPACE:/);
  });

  it("requires previous JWT key values as a pair", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        AUTH_JWT_PREVIOUS_KID: "v0",
      }),
    ).toThrow(/AUTH_JWT_PREVIOUS_SECRET:/);
  });

  it("rejects session idle TTL longer than absolute TTL", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        AUTH_SESSION_IDLE_TTL_SECONDS: "3600",
        AUTH_SESSION_ABSOLUTE_TTL_SECONDS: "1800",
      }),
    ).toThrow(/AUTH_SESSION_IDLE_TTL_SECONDS:/);
  });

  it("requires secure refresh cookies in production", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        NODE_ENV: "production",
        AUTH_REFRESH_COOKIE_SECURE: "false",
      }),
    ).toThrow(/AUTH_REFRESH_COOKIE_SECURE: must be true in production/);
  });

  it("rejects the example JWT secret in production", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        NODE_ENV: "production",
        AUTH_JWT_CURRENT_SECRET:
          "change-me-with-a-random-jwt-secret-of-at-least-256-bits",
      }),
    ).toThrow(
      /AUTH_JWT_CURRENT_SECRET: must not use the development placeholder/,
    );
  });

  it("rejects a non-PostgreSQL database URL", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        DATABASE_URL: "https://example.com/database",
      }),
    ).toThrow(/Environment validation failed: DATABASE_URL:/);
  });

  it("rejects a pooled URL for the direct migration connection", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        DATABASE_URL_UNPOOLED:
          "postgresql://database-user:secure-database-password@example-pooler.neon.tech/database?sslmode=verify-full&channel_binding=require",
      }),
    ).toThrow(/Environment validation failed: DATABASE_URL_UNPOOLED:/);
  });

  it("allows logging values to be omitted for environment defaults", () => {
    const result = environmentSchema.parse(VALID_ENVIRONMENT);

    expect(result.LOG_LEVEL).toBeUndefined();
    expect(result.LOG_PRETTY).toBeUndefined();
    expect(result.LOG_HEALTH_REQUESTS).toBeUndefined();
  });

  it("rejects an unsupported log level", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        LOG_LEVEL: "verbose",
      }),
    ).toThrow(/Environment validation failed: LOG_LEVEL:/);
  });

  it("rejects pretty logging in production", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        NODE_ENV: "production",
        LOG_PRETTY: "true",
      }),
    ).toThrow(
      "Environment validation failed: LOG_PRETTY: must be false in production",
    );
  });

  it("requires database TLS and channel binding in production", () => {
    expect(() =>
      validateEnvironment({
        ...VALID_ENVIRONMENT,
        NODE_ENV: "production",
        DATABASE_URL:
          "postgresql://database-user:secure-database-password@example.neon.tech/database?sslmode=disable",
      }),
    ).toThrow(/Environment validation failed: DATABASE_URL:/);
  });
});
