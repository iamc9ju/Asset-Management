import type { AddressInfo } from "node:net";
import { Controller, Get, type INestApplication } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";
import { APP_ERROR_CODE } from "../../../shared/errors/app-error-code";
import type { ErrorResponseEnvelope } from "../../../shared/errors/error-response.types";
import { API_GLOBAL_PREFIX } from "../../../shared/http/api-route.constants";
import { GlobalExceptionFilter } from "../../../shared/http/errors/global-exception.filter";
import { OPENAPI_SECURITY_SCHEME } from "../../../shared/http/openapi/openapi.constants";
import { REQUEST_ID_HEADER } from "../../../shared/http/request-id/request-id.constants";
import { requestIdMiddleware } from "../../../shared/http/request-id/request-id.middleware";
import { createApiDataResponse } from "../../../shared/http/responses/api-response.factory";
import {
  PERMISSION_CODE,
  type PermissionCode,
} from "../../iam/domain/permission-code";
import { USER_STATUS } from "../../iam/domain/user-status";
import { AuthenticateAccessTokenService } from "../application/services/authenticate-access-token.service";
import type { AuthenticatedIdentity } from "../domain/authenticated-identity";
import { AUTH_HTTP_HEADER, AUTH_TOKEN_TYPE } from "../domain/auth.constants";
import { RequirePermissions } from "./decorators/require-permissions.decorator";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { PermissionGuard } from "./guards/permission.guard";

const ACCESS_TOKEN = "header.payload.signature";
const PROTECTED_ENDPOINT_PATH = "/api/v1/permission-test";
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

function createIdentity(
  permissionCodes: readonly PermissionCode[],
): AuthenticatedIdentity {
  return {
    userId: USER_ID,
    sessionId: SESSION_ID,
    displayName: "Permission Test User",
    status: USER_STATUS.ACTIVE,
    permissionVersion: "1",
    permissionCodes,
  };
}

@Controller("permission-test")
class PermissionTestController {
  @Get()
  @RequirePermissions(PERMISSION_CODE.ASSET_READ, PERMISSION_CODE.ASSET_UPDATE)
  getProtectedResource() {
    return createApiDataResponse({ allowed: true });
  }
}

describe("Permission enforcement integration", () => {
  let app: INestApplication;
  let baseUrl: string;
  let authenticateAccessTokenService: { execute: jest.Mock };

  beforeAll(async () => {
    authenticateAccessTokenService = { execute: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      controllers: [PermissionTestController],
      providers: [
        {
          provide: AuthenticateAccessTokenService,
          useValue: authenticateAccessTokenService,
        },
        AccessTokenGuard,
        PermissionGuard,
        { provide: APP_FILTER, useClass: GlobalExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.use(requestIdMiddleware);
    app.setGlobalPrefix(API_GLOBAL_PREFIX);
    await app.listen(0, "127.0.0.1");

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    authenticateAccessTokenService.execute.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects a request without a Bearer access token before authorization", async () => {
    const response = await fetch(`${baseUrl}${PROTECTED_ENDPOINT_PATH}`);
    const body = (await response.json()) as ErrorResponseEnvelope;

    expect(response.status).toBe(401);
    expect(response.headers.get(AUTH_HTTP_HEADER.WWW_AUTHENTICATE)).toBe(
      AUTH_TOKEN_TYPE.BEARER,
    );
    expect(body.error).toMatchObject({
      code: APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID,
      request_id: expect.any(String),
    });
    expect(authenticateAccessTokenService.execute).not.toHaveBeenCalled();
  });

  it("rejects an identity that is missing any required permission", async () => {
    authenticateAccessTokenService.execute.mockResolvedValue(
      createIdentity([PERMISSION_CODE.ASSET_READ]),
    );

    const response = await fetch(`${baseUrl}${PROTECTED_ENDPOINT_PATH}`, {
      headers: {
        [AUTH_HTTP_HEADER.AUTHORIZATION]: `Bearer ${ACCESS_TOKEN}`,
      },
    });
    const body = (await response.json()) as ErrorResponseEnvelope;

    expect(response.status).toBe(403);
    expect(response.headers.get(REQUEST_ID_HEADER)).toEqual(expect.any(String));
    expect(response.headers.get(AUTH_HTTP_HEADER.WWW_AUTHENTICATE)).toBeNull();
    expect(body.error).toMatchObject({
      code: APP_ERROR_CODE.AUTH_PERMISSION_DENIED,
      message: "You do not have permission to perform this action.",
      details: {},
      request_id: expect.any(String),
    });
  });

  it("allows an identity that has every required permission", async () => {
    authenticateAccessTokenService.execute.mockResolvedValue(
      createIdentity([
        PERMISSION_CODE.ASSET_READ,
        PERMISSION_CODE.ASSET_UPDATE,
      ]),
    );

    const response = await fetch(`${baseUrl}${PROTECTED_ENDPOINT_PATH}`, {
      headers: {
        [AUTH_HTTP_HEADER.AUTHORIZATION]: `Bearer ${ACCESS_TOKEN}`,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { allowed: true },
    });
  });

  it("uses the current permission state for every request", async () => {
    authenticateAccessTokenService.execute
      .mockResolvedValueOnce(createIdentity([PERMISSION_CODE.ASSET_READ]))
      .mockResolvedValueOnce(
        createIdentity([
          PERMISSION_CODE.ASSET_READ,
          PERMISSION_CODE.ASSET_UPDATE,
        ]),
      );
    const request = () =>
      fetch(`${baseUrl}${PROTECTED_ENDPOINT_PATH}`, {
        headers: {
          [AUTH_HTTP_HEADER.AUTHORIZATION]: `Bearer ${ACCESS_TOKEN}`,
        },
      });

    const deniedResponse = await request();
    const allowedResponse = await request();

    expect(deniedResponse.status).toBe(403);
    expect(allowedResponse.status).toBe(200);
    expect(authenticateAccessTokenService.execute).toHaveBeenCalledTimes(2);
  });

  it("publishes Bearer authentication and authorization failures in OpenAPI", () => {
    const document: OpenAPIObject = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle("Permission test").setVersion("1").build(),
    );
    const operation = document.paths[PROTECTED_ENDPOINT_PATH]?.get;

    expect(operation).toBeDefined();
    expect(operation?.security).toEqual([
      { [OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN]: [] },
    ]);
    expect(operation?.responses["401"]).toBeDefined();
    expect(operation?.responses["403"]).toBeDefined();
  });
});
