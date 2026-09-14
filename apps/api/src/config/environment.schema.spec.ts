import { environmentSchema, validateEnvironment } from "./environment.schema";

const VALID_ENVIRONMENT = {
  NODE_ENV: "development",
  WEB_ORIGIN: "http://localhost:5173",
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
