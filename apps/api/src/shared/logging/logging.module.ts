import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { LoggerModule, type Params } from "nestjs-pino";
import type { Options as PinoHttpOptions } from "pino-http";
import {
  createLoggingConfiguration,
  type ApplicationEnvironment,
  type LoggingConfiguration,
  type LoggingEnvironment,
  type LogLevel,
} from "../../config/logging.config";
import {
  isUnknownHttpRoute,
  serializeHttpRequest,
  serializeHttpResponse,
} from "./http-log.serializer";
import { resolveHttpLogLevel } from "./http-log.policy";
import { LOG_EVENTS } from "./log-event.constants";
import {
  LOG_REDACTION_CENSOR,
  LOG_REDACTION_PATHS,
} from "./log-redaction.constants";
import type { RequestWithLoggingContext } from "./logging.types";
import { ApplicationLifecycleLogger } from "./application-lifecycle.logger";

const HEALTH_ROUTES = new Set(["/api/v1/health", "/api/v1/health/ready"]);

function resolveLoggingEnvironment(config: ConfigService): LoggingEnvironment {
  return {
    NODE_ENV: config.getOrThrow<ApplicationEnvironment>("NODE_ENV"),
    LOG_LEVEL: config.get<LogLevel>("LOG_LEVEL"),
    LOG_PRETTY: config.get<boolean>("LOG_PRETTY"),
    LOG_HEALTH_REQUESTS: config.get<boolean>("LOG_HEALTH_REQUESTS"),
  };
}

function isHealthRoute(request: RequestWithLoggingContext): boolean {
  const route = serializeHttpRequest(request).route.replace(/\/$/, "");

  return HEALTH_ROUTES.has(route);
}

function resolveDuration(loggableObject: unknown): number {
  if (
    typeof loggableObject !== "object" ||
    loggableObject === null ||
    !("responseTime" in loggableObject)
  ) {
    return 0;
  }

  const responseTime = loggableObject.responseTime;

  return typeof responseTime === "number" && Number.isFinite(responseTime)
    ? Math.max(0, responseTime)
    : 0;
}

function createTerminalLogObject(
  request: RequestWithLoggingContext,
  response: Response,
  loggableObject: unknown,
  failed: boolean,
): Record<string, unknown> {
  return {
    event: failed
      ? LOG_EVENTS.HTTP_REQUEST_FAILED
      : LOG_EVENTS.HTTP_REQUEST_COMPLETED,
    ...serializeHttpResponse(response),
    duration_ms: resolveDuration(loggableObject),
    ...request.loggingContext,
  };
}

export function createPinoHttpOptions(
  logging: Readonly<LoggingConfiguration>,
): PinoHttpOptions<RequestWithLoggingContext, Response> {
  return {
    messageKey: "message",
    timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
    level: logging.level,
    base: {
      service: logging.serviceName,
      environment: logging.environment,
    },
    transport: logging.pretty
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            messageKey: "message",
            singleLine: true,
            timestampKey: "timestamp",
            translateTime: "SYS:standard",
          },
        }
      : undefined,
    redact: {
      paths: [...LOG_REDACTION_PATHS],
      censor: LOG_REDACTION_CENSOR,
    },
    genReqId: (request) => request.requestId,
    wrapSerializers: false,
    serializers: {
      req: () => undefined,
      res: () => undefined,
    },
    customProps: (request) => serializeHttpRequest(request),
    customLogLevel: (request, response) =>
      resolveHttpLogLevel({
        statusCode: response.statusCode,
        isUnknownRoute: isUnknownHttpRoute(request),
        isHealthRoute: isHealthRoute(request),
        logHealthRequests: logging.logHealthRequests,
      }),
    customSuccessMessage: (_request, response) =>
      response.statusCode >= 400
        ? "HTTP request failed"
        : "HTTP request completed",
    customErrorMessage: () => "HTTP request failed",
    customSuccessObject: (request, response, loggableObject) =>
      createTerminalLogObject(
        request,
        response,
        loggableObject,
        response.statusCode >= 400,
      ),
    customErrorObject: (request, response, _error, loggableObject) =>
      createTerminalLogObject(request, response, loggableObject, true),
  };
}

function createLoggerParams(
  config: ConfigService,
): Params<RequestWithLoggingContext, Response> {
  const logging = createLoggingConfiguration(resolveLoggingEnvironment(config));

  return {
    nativeLogger: {
      structuredParams: true,
      flattenParams: true,
    },
    pinoHttp: createPinoHttpOptions(logging),
  };
}

@Module({
  imports: [
    LoggerModule.forRootAsync<RequestWithLoggingContext, Response>({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: createLoggerParams,
    }),
  ],
  providers: [ApplicationLifecycleLogger],
  exports: [LoggerModule, ApplicationLifecycleLogger],
})
export class LoggingModule {}
