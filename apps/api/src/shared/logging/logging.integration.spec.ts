import { Writable } from "node:stream";
import type { AddressInfo } from "node:net";
import {
  Body,
  Controller,
  Get,
  type INestApplication,
  Post,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { IsString, MinLength } from "class-validator";
import type { Response as ExpressResponse } from "express";
import { LoggerModule } from "nestjs-pino";
import {
  APPLICATION_SERVICE_NAME,
  createLoggingConfiguration,
} from "../../config/logging.config";
import { APP_ERROR_CODE, type AppErrorCode } from "../errors/app-error-code";
import { AppError } from "../errors/app-error";
import type { ErrorResponseEnvelope } from "../errors/error-response.types";
import { GlobalExceptionFilter } from "../http/errors/global-exception.filter";
import { REQUEST_ID_HEADER } from "../http/request-id/request-id.constants";
import { requestIdMiddleware } from "../http/request-id/request-id.middleware";
import { createValidationPipe } from "../http/validation/validation.pipe";
import { LOG_EVENTS } from "./log-event.constants";
import { createPinoHttpOptions } from "./logging.module";
import type { RequestWithLoggingContext } from "./logging.types";

const VALID_REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";
const INVALID_REQUEST_ID = "invalid-request-id";

const PINO_LEVEL = {
  INFO: 30,
  WARN: 40,
  ERROR: 50,
} as const;

const LOG_FLUSH_MAX_ATTEMPTS = 100;

const HTTP_TERMINAL_SINGLETON_FIELDS = [
  "request_id",
  "method",
  "route",
  "event",
  "status_code",
  "duration_ms",
  "timestamp",
  "message",
] as const;

const SECRET_CANARIES = {
  authorization: "authorization-secret-canary",
  cookie: "cookie-secret-canary",
  query: "query-secret-canary",
  password: "password-secret-canary",
  database: "database-secret-canary",
} as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface CapturedLogRecord {
  readonly level?: number;
  readonly timestamp?: string;
  readonly service?: string;
  readonly environment?: string;
  readonly event?: string;
  readonly request_id?: string;
  readonly method?: string;
  readonly route?: string;
  readonly status_code?: number;
  readonly duration_ms?: number;
  readonly error_code?: AppErrorCode;
  readonly error_type?: string;
  readonly message?: string;
  readonly [key: string]: unknown;
}

class LogCaptureStream extends Writable {
  private output = "";

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.output += chunk.toString();
    callback();
  }

  reset(): void {
    this.output = "";
  }

  get rawOutput(): string {
    return this.output;
  }

  records(): CapturedLogRecord[] {
    return this.output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const parsed: unknown = JSON.parse(line);

        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          throw new Error(`Expected a JSON log object, received: ${line}`);
        }

        return parsed as CapturedLogRecord;
      });
  }

  terminalRecords(): CapturedLogRecord[] {
    return this.records().filter(
      (record) =>
        record.event === LOG_EVENTS.HTTP_REQUEST_COMPLETED ||
        record.event === LOG_EVENTS.HTTP_REQUEST_FAILED,
    );
  }

  terminalLines(): string[] {
    return this.output
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.includes(`"event":"${LOG_EVENTS.HTTP_REQUEST_COMPLETED}"`) ||
          line.includes(`"event":"${LOG_EVENTS.HTTP_REQUEST_FAILED}"`),
      );
  }
}

class ValidationRequestDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

@Controller("logging-test")
class LoggingTestController {
  @Get("success")
  success(): { readonly ok: true } {
    return { ok: true };
  }

  @Post("validation")
  validation(@Body() body: ValidationRequestDto): { readonly ok: true } {
    void body;

    return { ok: true };
  }

  @Get("conflict")
  conflict(): never {
    throw new AppError(APP_ERROR_CODE.CONFLICT, {
      details: {
        asset_id: "asset-123",
        password: SECRET_CANARIES.password,
      },
    });
  }

  @Post("unexpected")
  unexpected(@Body() body: Readonly<Record<string, unknown>>): never {
    void body;

    throw new Error(`SQL connection failed: ${SECRET_CANARIES.database}`);
  }
}

@Controller("health")
class LoggingHealthController {
  @Get()
  health(): { readonly status: "up" } {
    return { status: "up" };
  }

  @Get("ready")
  ready(): never {
    throw new AppError(APP_ERROR_CODE.SERVICE_UNAVAILABLE);
  }
}

describe("Structured logging integration", () => {
  let app: INestApplication;
  let baseUrl: string;
  let logCapture: LogCaptureStream;

  beforeAll(async () => {
    logCapture = new LogCaptureStream();

    const loggingConfiguration = createLoggingConfiguration({
      NODE_ENV: "production",
      LOG_LEVEL: "trace",
      LOG_PRETTY: false,
      LOG_HEALTH_REQUESTS: false,
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot<RequestWithLoggingContext, ExpressResponse>({
          pinoHttp: [createPinoHttpOptions(loggingConfiguration), logCapture],
        }),
      ],
      controllers: [LoggingTestController, LoggingHealthController],
      providers: [
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.use(requestIdMiddleware);
    app.useGlobalPipes(createValidationPipe());
    app.setGlobalPrefix("api/v1");

    await app.listen(0, "127.0.0.1");

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
    logCapture.end();
  });

  beforeEach(() => {
    logCapture.reset();
  });

  async function flushLogWrites(): Promise<void> {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }

  async function waitForTerminalLogCount(expectedCount: number): Promise<void> {
    for (let attempt = 0; attempt < LOG_FLUSH_MAX_ATTEMPTS; attempt += 1) {
      if (logCapture.terminalRecords().length >= expectedCount) {
        return;
      }

      await flushLogWrites();
    }

    throw new Error(
      `Expected ${expectedCount} terminal log(s), received: ` +
        logCapture.rawOutput,
    );
  }

  async function readErrorResponse(
    path: string,
    init?: RequestInit,
  ): Promise<{
    readonly response: Response;
    readonly body: ErrorResponseEnvelope;
  }> {
    const response = await fetch(`${baseUrl}${path}`, init);
    const body = (await response.json()) as ErrorResponseEnvelope;

    return { response, body };
  }

  async function expectSingleTerminalLog(): Promise<CapturedLogRecord> {
    await waitForTerminalLogCount(1);
    await flushLogWrites();

    const terminalLogs = logCapture.terminalRecords();
    const terminalLines = logCapture.terminalLines();

    expect(terminalLogs).toHaveLength(1);
    expect(terminalLines).toHaveLength(1);

    const log = terminalLogs[0];
    const rawLog = terminalLines[0];

    if (!log || !rawLog) {
      throw new Error("Expected one terminal HTTP log");
    }

    for (const field of HTTP_TERMINAL_SINGLETON_FIELDS) {
      expect(rawLog.split(`"${field}":`)).toHaveLength(2);
    }

    return log;
  }

  function expectCommonLogFields(
    log: CapturedLogRecord,
    expected: {
      readonly level: number;
      readonly event: string;
      readonly requestId: string;
      readonly method: string;
      readonly route: string;
      readonly statusCode: number;
    },
  ): void {
    expect(log).toMatchObject({
      level: expected.level,
      service: APPLICATION_SERVICE_NAME,
      environment: "production",
      event: expected.event,
      request_id: expected.requestId,
      method: expected.method,
      route: expected.route,
      status_code: expected.statusCode,
    });

    expect(log.duration_ms).toEqual(expect.any(Number));
    expect(log.duration_ms).toBeGreaterThanOrEqual(0);
    expect(log.timestamp).toEqual(expect.any(String));
    expect(log.message).toEqual(expect.any(String));
    expect(log).not.toHaveProperty("time");
    expect(log).not.toHaveProperty("msg");

    if (typeof log.timestamp !== "string") {
      throw new Error("Expected terminal log timestamp to be a string");
    }

    expect(Number.isNaN(Date.parse(log.timestamp))).toBe(false);
  }

  it("writes one info terminal log for a successful request", async () => {
    const response = await fetch(`${baseUrl}/api/v1/logging-test/success`, {
      headers: {
        [REQUEST_ID_HEADER]: VALID_REQUEST_ID,
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(VALID_REQUEST_ID);

    const log = await expectSingleTerminalLog();

    expectCommonLogFields(log, {
      level: PINO_LEVEL.INFO,
      event: LOG_EVENTS.HTTP_REQUEST_COMPLETED,
      requestId: VALID_REQUEST_ID,
      method: "GET",
      route: "/api/v1/logging-test/success",
      statusCode: 200,
    });

    expect(log.error_code).toBeUndefined();
    expect(log.error_type).toBeUndefined();
  });

  it("writes one warn log with a generated request ID for validation errors", async () => {
    const { response, body } = await readErrorResponse(
      "/api/v1/logging-test/validation",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          [REQUEST_ID_HEADER]: INVALID_REQUEST_ID,
        },
        body: JSON.stringify({}),
      },
    );

    const responseRequestId = response.headers.get(REQUEST_ID_HEADER);

    expect(response.status).toBe(400);
    expect(responseRequestId).not.toBeNull();
    expect(responseRequestId).not.toBe(INVALID_REQUEST_ID);
    expect(responseRequestId).toMatch(UUID_PATTERN);
    expect(body.error.request_id).toBe(responseRequestId);
    expect(body.error.code).toBe(APP_ERROR_CODE.VALIDATION_FAILED);

    const log = await expectSingleTerminalLog();

    expectCommonLogFields(log, {
      level: PINO_LEVEL.WARN,
      event: LOG_EVENTS.HTTP_REQUEST_FAILED,
      requestId: responseRequestId as string,
      method: "POST",
      route: "/api/v1/logging-test/validation",
      statusCode: 400,
    });

    expect(log.error_code).toBe(APP_ERROR_CODE.VALIDATION_FAILED);
  });

  it("writes one info log for an unknown-route 404", async () => {
    const { response, body } = await readErrorResponse(
      "/api/v1/does-not-exist",
    );

    const requestId = response.headers.get(REQUEST_ID_HEADER);

    expect(response.status).toBe(404);
    expect(requestId).not.toBeNull();
    expect(body.error.request_id).toBe(requestId);
    expect(body.error.code).toBe(APP_ERROR_CODE.RESOURCE_NOT_FOUND);

    const log = await expectSingleTerminalLog();

    expectCommonLogFields(log, {
      level: PINO_LEVEL.INFO,
      event: LOG_EVENTS.HTTP_REQUEST_FAILED,
      requestId: requestId as string,
      method: "GET",
      route: "/api/v1/does-not-exist",
      statusCode: 404,
    });

    expect(log.error_code).toBe(APP_ERROR_CODE.RESOURCE_NOT_FOUND);
  });

  it("writes one warn log with the stable error code for AppError", async () => {
    const { response, body } = await readErrorResponse(
      "/api/v1/logging-test/conflict",
    );

    const requestId = response.headers.get(REQUEST_ID_HEADER);

    expect(response.status).toBe(409);
    expect(requestId).not.toBeNull();
    expect(body.error.request_id).toBe(requestId);
    expect(body.error.code).toBe(APP_ERROR_CODE.CONFLICT);

    const log = await expectSingleTerminalLog();

    expectCommonLogFields(log, {
      level: PINO_LEVEL.WARN,
      event: LOG_EVENTS.HTTP_REQUEST_FAILED,
      requestId: requestId as string,
      method: "GET",
      route: "/api/v1/logging-test/conflict",
      statusCode: 409,
    });

    expect(log.error_code).toBe(APP_ERROR_CODE.CONFLICT);
    expect(logCapture.rawOutput).not.toContain(SECRET_CANARIES.password);
  });

  it("writes one safe error log without request or exception secrets", async () => {
    const { response, body } = await readErrorResponse(
      `/api/v1/logging-test/unexpected?access_token=${SECRET_CANARIES.query}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${SECRET_CANARIES.authorization}`,
          cookie: `session=${SECRET_CANARIES.cookie}`,
        },
        body: JSON.stringify({
          password: SECRET_CANARIES.password,
        }),
      },
    );

    const requestId = response.headers.get(REQUEST_ID_HEADER);

    expect(response.status).toBe(500);
    expect(requestId).not.toBeNull();
    expect(body.error.request_id).toBe(requestId);
    expect(body.error.code).toBe(APP_ERROR_CODE.INTERNAL_ERROR);

    const log = await expectSingleTerminalLog();

    expectCommonLogFields(log, {
      level: PINO_LEVEL.ERROR,
      event: LOG_EVENTS.HTTP_REQUEST_FAILED,
      requestId: requestId as string,
      method: "POST",
      route: "/api/v1/logging-test/unexpected",
      statusCode: 500,
    });

    expect(log.error_code).toBe(APP_ERROR_CODE.INTERNAL_ERROR);
    expect(log.error_type).toBe(Error.name);

    const rawLogs = logCapture.rawOutput;

    for (const secret of Object.values(SECRET_CANARIES)) {
      expect(rawLogs).not.toContain(secret);
    }
  });

  it("suppresses successful health request logs by default", async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);

    expect(response.status).toBe(200);

    await flushLogWrites();
    await flushLogWrites();

    expect(logCapture.terminalRecords()).toHaveLength(0);
  });

  it("logs failed readiness requests at error level", async () => {
    const { response, body } = await readErrorResponse("/api/v1/health/ready");

    const requestId = response.headers.get(REQUEST_ID_HEADER);

    expect(response.status).toBe(503);
    expect(requestId).not.toBeNull();
    expect(body.error.request_id).toBe(requestId);
    expect(body.error.code).toBe(APP_ERROR_CODE.SERVICE_UNAVAILABLE);

    const log = await expectSingleTerminalLog();

    expectCommonLogFields(log, {
      level: PINO_LEVEL.ERROR,
      event: LOG_EVENTS.HTTP_REQUEST_FAILED,
      requestId: requestId as string,
      method: "GET",
      route: "/api/v1/health/ready",
      statusCode: 503,
    });

    expect(log.error_code).toBe(APP_ERROR_CODE.SERVICE_UNAVAILABLE);
    expect(log.error_type).toBe(AppError.name);
  });
});
