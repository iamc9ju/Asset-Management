import type { AddressInfo } from "node:net";
import { type INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import { AuthenticateAccessTokenService } from "../application/services/authenticate-access-token.service";
import type { AuthSessionConfig } from "../application/config/auth-session.config";
import { AUTH_SESSION_CONFIG } from "../application/config/auth-session.config";
import { LoginService } from "../application/services/login.service";
import { RefreshSessionService } from "../application/services/refresh-session.service";
import { CLOCK, type Clock } from "../application/ports/clock.port";
import {
  AUTH_COOKIE,
  AUTH_HTTP_HEADER,
  AUTH_TOKEN_TYPE,
} from "../domain/auth.constants";
import { PERMISSION_CODE } from "../../iam/domain/permission-code";
import { USER_STATUS } from "../../iam/domain/user-status";
import { APP_ERROR_CODE } from "../../../shared/errors/app-error-code";
import { AppError } from "../../../shared/errors/app-error";
import type { ErrorResponseEnvelope } from "../../../shared/errors/error-response.types";
import { API_GLOBAL_PREFIX } from "../../../shared/http/api-route.constants";
import { GlobalExceptionFilter } from "../../../shared/http/errors/global-exception.filter";
import { OPENAPI_SECURITY_SCHEME } from "../../../shared/http/openapi/openapi.constants";
import { REQUEST_ID_HEADER } from "../../../shared/http/request-id/request-id.constants";
import { requestIdMiddleware } from "../../../shared/http/request-id/request-id.middleware";
import { createValidationPipe } from "../../../shared/http/validation/validation.pipe";
import { AuthController } from "./auth.controller";
import { AuthCookieService } from "./auth-cookie.service";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { AuthOriginGuard } from "./guards/auth-origin.guard";

const NOW = new Date("2026-09-17T10:00:00.000Z");
const REFRESH_EXPIRES_AT = new Date("2026-09-24T10:00:00.000Z");
const TRUSTED_ORIGIN = "https://app.example.com";

describe("AuthController integration", () => {
  let app: INestApplication;
  let baseUrl: string;
  let loginService: { execute: jest.Mock };
  let refreshSessionService: { execute: jest.Mock };
  let authenticateAccessTokenService: { execute: jest.Mock };

  beforeAll(async () => {
    loginService = { execute: jest.fn() };
    refreshSessionService = { execute: jest.fn() };
    authenticateAccessTokenService = { execute: jest.fn() };
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
        { provide: RefreshSessionService, useValue: refreshSessionService },
        {
          provide: AuthenticateAccessTokenService,
          useValue: authenticateAccessTokenService,
        },
        { provide: AUTH_SESSION_CONFIG, useValue: sessionConfig },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === "WEB_ORIGIN") {
                return TRUSTED_ORIGIN;
              }

              throw new Error(`Unexpected configuration key: ${key}`);
            }),
          },
        },
        { provide: CLOCK, useValue: clock },
        AuthCookieService,
        AccessTokenGuard,
        AuthOriginGuard,
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
    refreshSessionService.execute.mockReset();
    authenticateAccessTokenService.execute.mockReset();
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
    expect(response.headers.get(REQUEST_ID_HEADER)).toEqual(expect.any(String));
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

  it("rotates the refresh cookie and returns a new access token", async () => {
    refreshSessionService.execute.mockResolvedValue({
      accessToken: "rotated-access-token",
      tokenType: AUTH_TOKEN_TYPE.BEARER,
      expiresIn: 900,
      refreshToken: "replacement-token-id.replacement-token-secret",
      refreshTokenExpiresAt: REFRESH_EXPIRES_AT,
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        [AUTH_HTTP_HEADER.ORIGIN]: TRUSTED_ORIGIN,
        [AUTH_HTTP_HEADER.COOKIE]: `${AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME}=current-token-id.current-token-secret`,
        "user-agent": "Integration Browser",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      `${AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME}=replacement-token-id.replacement-token-secret`,
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        access_token: "rotated-access-token",
        token_type: AUTH_TOKEN_TYPE.BEARER,
        expires_in: 900,
      },
    });
    expect(refreshSessionService.execute).toHaveBeenCalledWith({
      rawRefreshToken: "current-token-id.current-token-secret",
      client: {
        requestId: expect.any(String),
        ipAddress: "127.0.0.1",
        userAgent: "Integration Browser",
      },
    });
  });

  it("rejects an untrusted Origin before reading the refresh credential", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        [AUTH_HTTP_HEADER.ORIGIN]: "https://attacker.example.com",
        [AUTH_HTTP_HEADER.COOKIE]: `${AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME}=current-token-id.current-token-secret`,
      },
    });
    const body = (await response.json()) as ErrorResponseEnvelope;

    expect(response.status).toBe(403);
    expect(body.error.code).toBe(APP_ERROR_CODE.FORBIDDEN);
    expect(refreshSessionService.execute).not.toHaveBeenCalled();
  });

  it("clears an invalid refresh credential", async () => {
    refreshSessionService.execute.mockRejectedValue(
      new AppError(APP_ERROR_CODE.AUTH_SESSION_INVALID),
    );

    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        [AUTH_HTTP_HEADER.ORIGIN]: TRUSTED_ORIGIN,
        [AUTH_HTTP_HEADER.COOKIE]: `${AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME}=invalid-token`,
      },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain(
      `${AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME}=;`,
    );
  });

  it("clears the cookie when the refresh credential is missing", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { [AUTH_HTTP_HEADER.ORIGIN]: TRUSTED_ORIGIN },
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain(
      `${AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME}=;`,
    );
    expect(refreshSessionService.execute).not.toHaveBeenCalled();
  });

  it("returns the current user from the authenticated identity", async () => {
    authenticateAccessTokenService.execute.mockResolvedValue({
      userId: "11111111-1111-4111-8111-111111111111",
      sessionId: "22222222-2222-4222-8222-222222222222",
      displayName: "System Administrator",
      status: USER_STATUS.ACTIVE,
      permissionVersion: "3",
      permissionCodes: [PERMISSION_CODE.ASSET_READ, PERMISSION_CODE.USER_READ],
    });

    const response = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: {
        [AUTH_HTTP_HEADER.AUTHORIZATION]: "Bearer signed-access-token",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get(REQUEST_ID_HEADER)).toEqual(expect.any(String));
    await expect(response.json()).resolves.toEqual({
      data: {
        user_id: "11111111-1111-4111-8111-111111111111",
        display_name: "System Administrator",
        status: USER_STATUS.ACTIVE,
        permissions: [PERMISSION_CODE.ASSET_READ, PERMISSION_CODE.USER_READ],
      },
    });
    expect(authenticateAccessTokenService.execute).toHaveBeenCalledWith(
      "signed-access-token",
    );
  });

  it("rejects a missing Bearer token with the standard error contract", async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/me`);
    const body = (await response.json()) as ErrorResponseEnvelope;

    expect(response.status).toBe(401);
    expect(response.headers.get(AUTH_HTTP_HEADER.WWW_AUTHENTICATE)).toBe(
      AUTH_TOKEN_TYPE.BEARER,
    );
    expect(body.error).toMatchObject({
      code: APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID,
      message: "The access token is invalid.",
      details: {},
      request_id: expect.any(String),
    });
    expect(authenticateAccessTokenService.execute).not.toHaveBeenCalled();
  });

  it("publishes the authentication request and response schemas in OpenAPI", () => {
    const document: OpenAPIObject = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Auth test").setVersion("1").build(),
    );
    const operation = document.paths["/api/v1/auth/login"]?.post;

    expect(operation).toBeDefined();
    expect(operation?.requestBody).toBeDefined();
    expect(operation?.responses["200"]).toMatchObject({
      headers: {
        [REQUEST_ID_HEADER]: {
          schema: { type: "string", format: "uuid" },
        },
      },
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["data"],
            properties: {
              data: {
                $ref: "#/components/schemas/LoginResponseDataDto",
              },
            },
          },
        },
      },
    });
    expect(operation?.responses["401"]).toBeDefined();

    const refreshOperation = document.paths["/api/v1/auth/refresh"]?.post;
    expect(refreshOperation).toBeDefined();
    expect(refreshOperation?.security).toEqual([
      { [OPENAPI_SECURITY_SCHEME.REFRESH_TOKEN]: [] },
    ]);
    expect(refreshOperation?.responses["401"]).toBeDefined();
    expect(refreshOperation?.responses["403"]).toBeDefined();

    const meOperation = document.paths["/api/v1/auth/me"]?.get;
    expect(meOperation).toBeDefined();
    expect(meOperation?.security).toEqual([
      { [OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN]: [] },
    ]);
    expect(meOperation?.responses["200"]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["data"],
            properties: {
              data: { $ref: "#/components/schemas/MeResponseDataDto" },
            },
          },
        },
      },
    });
    expect(meOperation?.responses["401"]).toBeDefined();
  });
});
