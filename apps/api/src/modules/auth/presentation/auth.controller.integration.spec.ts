import type { AddressInfo } from "node:net";
import { type INestApplication } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import type { AuthSessionConfig } from "../application/config/auth-session.config";
import { AUTH_SESSION_CONFIG } from "../application/config/auth-session.config";
import { LoginService } from "../application/services/login.service";
import { CLOCK, type Clock } from "../application/ports/clock.port";
import { AUTH_COOKIE, AUTH_TOKEN_TYPE } from "../domain/auth.constants";
import { APP_ERROR_CODE } from "../../../shared/errors/app-error-code";
import { AppError } from "../../../shared/errors/app-error";
import type { ErrorResponseEnvelope } from "../../../shared/errors/error-response.types";
import { API_GLOBAL_PREFIX } from "../../../shared/http/api-route.constants";
import { GlobalExceptionFilter } from "../../../shared/http/errors/global-exception.filter";
import { requestIdMiddleware } from "../../../shared/http/request-id/request-id.middleware";
import { createValidationPipe } from "../../../shared/http/validation/validation.pipe";
import { AuthController } from "./auth.controller";
import { AuthCookieService } from "./auth-cookie.service";

const NOW = new Date("2026-09-17T10:00:00.000Z");
const REFRESH_EXPIRES_AT = new Date("2026-09-24T10:00:00.000Z");

describe("AuthController integration", () => {
  let app: INestApplication;
  let baseUrl: string;
  let loginService: { execute: jest.Mock };

  beforeAll(async () => {
    loginService = { execute: jest.fn() };
    const sessionConfig: AuthSessionConfig = {
      idleTtlSeconds: 86_400,
      absoluteTtlSeconds: 604_800,
      refreshCookieSecure: true,
    };
    const clock: Clock = { now: () => new Date(NOW) };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: LoginService, useValue: loginService },
        { provide: AUTH_SESSION_CONFIG, useValue: sessionConfig },
        { provide: CLOCK, useValue: clock },
        AuthCookieService,
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.use(requestIdMiddleware);
    app.useGlobalPipes(createValidationPipe());
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.listen(0, "127.0.0.1");

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    loginService.execute.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the access token and sets the secure refresh cookie", async () => {
    loginService.execute.mockResolvedValue({
      accessToken: "signed-access-token",
      tokenType: AUTH_TOKEN_TYPE.BEARER,
      expiresIn: 900,
      refreshToken: "refresh-token-id.refresh-token-secret",
      refreshTokenExpiresAt: REFRESH_EXPIRES_AT,
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Integration Browser",
      },
      body: JSON.stringify({
        email: "  User@Example.COM ",
        password: "correct-password",
        device_label: "  Chrome on macOS  ",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        access_token: "signed-access-token",
        token_type: AUTH_TOKEN_TYPE.BEARER,
        expires_in: 900,
      },
    });
    expect(response.headers.get("set-cookie")).toContain(
      `${AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME}=refresh-token-id.refresh-token-secret`,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(response.headers.get("set-cookie")).toContain("Path=/api/v1/auth");
    expect(loginService.execute).toHaveBeenCalledWith({
      email: "User@Example.COM",
      password: "correct-password",
      deviceLabel: "Chrome on macOS",
      client: {
        requestId: expect.any(String),
        ipAddress: "127.0.0.1",
        userAgent: "Integration Browser",
      },
    });
  });

  it("returns the standard generic authentication error without a cookie", async () => {
    loginService.execute.mockRejectedValue(
      new AppError(APP_ERROR_CODE.AUTH_INVALID_CREDENTIALS),
    );

    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "missing@example.com",
        password: "incorrect-password",
      }),
    });
    const body = (await response.json()) as ErrorResponseEnvelope;

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(body.error).toMatchObject({
      code: APP_ERROR_CODE.AUTH_INVALID_CREDENTIALS,
      message: "The email or password is incorrect.",
      details: {},
      request_id: expect.any(String),
    });
  });

  it("rejects malformed and unknown request fields before the login service", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "",
        unexpected: "field",
      }),
    });
    const body = (await response.json()) as ErrorResponseEnvelope;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(APP_ERROR_CODE.VALIDATION_FAILED);
    expect(loginService.execute).not.toHaveBeenCalled();
  });

  it("publishes the login request and response schemas in OpenAPI", () => {
    const document: OpenAPIObject = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Auth test").setVersion("1").build(),
    );
    const operation = document.paths["/api/v1/auth/login"]?.post;

    expect(operation).toBeDefined();
    expect(operation?.requestBody).toBeDefined();
    expect(operation?.responses["200"]).toBeDefined();
    expect(operation?.responses["401"]).toBeDefined();
  });
});
