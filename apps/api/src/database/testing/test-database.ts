import type { DataSource } from "typeorm";

const DEFAULT_RETRY_POLICY = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1_000,
} as const;

export const TEST_DATABASE_SUITE_TIMEOUT_MS = 120_000;

const TRANSIENT_DATABASE_ERROR_CODES = new Set([
  "53300",
  "57P01",
  "57P02",
  "57P03",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

const TRANSIENT_DATABASE_ERROR_MESSAGES = [
  "connection terminated due to connection timeout",
  "connection terminated unexpectedly",
  "connection timeout",
  "connect etimedout",
  "read econnreset",
  "socket hang up",
  "the database system is starting up",
  "terminating connection due to administrator command",
] as const;

const MAX_ERROR_CAUSE_DEPTH = 5;

export interface TestDatabaseRetryOptions {
  readonly maxAttempts?: number;
  readonly initialDelayMs?: number;
}

export async function initializeTestDataSource(
  createDataSource: () => DataSource,
  options: TestDatabaseRetryOptions = {},
): Promise<DataSource> {
  const policy = resolveRetryPolicy(options);
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    const dataSource = createDataSource();

    try {
      await dataSource.initialize();
      await dataSource.query("SELECT 1");
      return dataSource;
    } catch (error) {
      lastError = error;
      await destroyIfInitialized(dataSource);

      if (
        !isTransientTestDatabaseError(error) ||
        attempt === policy.maxAttempts
      ) {
        throw error;
      }

      await waitForRetry(attempt, policy.initialDelayMs);
    }
  }

  throw lastError;
}

export async function waitForTestDatabase(
  dataSource: DataSource,
  options: TestDatabaseRetryOptions = {},
): Promise<void> {
  const policy = resolveRetryPolicy(options);

  for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
    try {
      await dataSource.query("SELECT 1");
      return;
    } catch (error) {
      if (
        !isTransientTestDatabaseError(error) ||
        attempt === policy.maxAttempts
      ) {
        throw error;
      }

      await waitForRetry(attempt, policy.initialDelayMs);
    }
  }
}

export function assertDirectTestDatabaseUrl(
  databaseUrl: string | undefined,
): asserts databaseUrl is string {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL_UNPOOLED must target a direct test database endpoint",
    );
  }

  if (new URL(databaseUrl).hostname.split(".")[0]?.endsWith("-pooler")) {
    throw new Error(
      "DATABASE_URL_UNPOOLED must use a direct endpoint without the -pooler suffix",
    );
  }
}

export function isTransientTestDatabaseError(error: unknown): boolean {
  const visited = new Set<object>();
  let current: unknown = error;

  for (let depth = 0; depth <= MAX_ERROR_CAUSE_DEPTH; depth += 1) {
    if (!(current instanceof Error) || visited.has(current)) {
      return false;
    }

    visited.add(current);
    const errorCode = readErrorCode(current);
    const normalizedMessage = current.message.toLowerCase();

    if (
      (errorCode && TRANSIENT_DATABASE_ERROR_CODES.has(errorCode)) ||
      TRANSIENT_DATABASE_ERROR_MESSAGES.some((message) =>
        normalizedMessage.includes(message),
      )
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}

interface ResolvedRetryPolicy {
  readonly maxAttempts: number;
  readonly initialDelayMs: number;
}

function resolveRetryPolicy(
  options: TestDatabaseRetryOptions,
): ResolvedRetryPolicy {
  const maxAttempts = options.maxAttempts ?? DEFAULT_RETRY_POLICY.MAX_ATTEMPTS;
  const initialDelayMs =
    options.initialDelayMs ?? DEFAULT_RETRY_POLICY.INITIAL_DELAY_MS;

  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(
      "Database retry maxAttempts must be a positive integer.",
    );
  }

  if (!Number.isSafeInteger(initialDelayMs) || initialDelayMs < 0) {
    throw new RangeError(
      "Database retry initialDelayMs must be a non-negative integer.",
    );
  }

  return { maxAttempts, initialDelayMs };
}

function readErrorCode(error: Error): string | undefined {
  if (!("code" in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === "string" || typeof code === "number"
    ? String(code)
    : undefined;
}

async function destroyIfInitialized(dataSource: DataSource): Promise<void> {
  if (!dataSource.isInitialized) {
    return;
  }

  try {
    await dataSource.destroy();
  } catch {
    // Preserve the connection error that caused the retry.
  }
}

async function waitForRetry(
  completedAttempt: number,
  initialDelayMs: number,
): Promise<void> {
  const delayMs = initialDelayMs * 2 ** (completedAttempt - 1);

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
