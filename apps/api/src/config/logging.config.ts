import type { EnvironmentVariables } from "./environment.schema";

export const APPLICATION_SERVICE_NAME = "asset-management-api" as const;

export type ApplicationEnvironment = EnvironmentVariables["NODE_ENV"];
export type LogLevel = NonNullable<EnvironmentVariables["LOG_LEVEL"]>;

export interface LoggingEnvironment {
  NODE_ENV: ApplicationEnvironment;
  LOG_LEVEL?: LogLevel;
  LOG_PRETTY?: boolean;
  LOG_HEALTH_REQUESTS?: boolean;
}

export interface LoggingConfiguration {
  serviceName: typeof APPLICATION_SERVICE_NAME;
  environment: ApplicationEnvironment;
  level: LogLevel;
  pretty: boolean;
  logHealthRequests: boolean;
}

const DEFAULT_LOG_LEVELS = {
  development: "debug",
  test: "silent",
  production: "info",
} as const satisfies Readonly<Record<ApplicationEnvironment, LogLevel>>;

const DEFAULT_PRETTY_LOGS = {
  development: true,
  test: false,
  production: false,
} as const satisfies Readonly<Record<ApplicationEnvironment, boolean>>;

const DEFAULT_LOG_HEALTH_REQUESTS = false;

export function createLoggingConfiguration(
  environment: Readonly<LoggingEnvironment>,
): LoggingConfiguration {
  return {
    serviceName: APPLICATION_SERVICE_NAME,
    environment: environment.NODE_ENV,
    level: environment.LOG_LEVEL ?? DEFAULT_LOG_LEVELS[environment.NODE_ENV],
    pretty:
      environment.NODE_ENV === "production"
        ? false
        : (environment.LOG_PRETTY ?? DEFAULT_PRETTY_LOGS[environment.NODE_ENV]),
    logHealthRequests:
      environment.LOG_HEALTH_REQUESTS ?? DEFAULT_LOG_HEALTH_REQUESTS,
  };
}
