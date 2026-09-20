import type { ExecutionContext } from "@nestjs/common";
import type { Response } from "express";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import { AuthenticateAccessTokenService } from "../../application/services/authenticate-access-token.service";
import type { AuthenticatedIdentity } from "../../domain/authenticated-identity";
import { AUTH_HTTP_HEADER, AUTH_TOKEN_TYPE } from "../../domain/auth.constants";
import { USER_STATUS } from "../../../iam/domain/user-status";
import type { AuthenticatedRequest } from "../authenticated-request";
import {
  AccessTokenGuard,
  extractBearerAccessToken,
} from "./access-token.guard";

const ACCESS_TOKEN = "header.payload.signature";
const AUTHENTICATED_IDENTITY: AuthenticatedIdentity = {
  userId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  displayName: "Test User",
  status: USER_STATUS.ACTIVE,
  permissionVersion: "1",
  permissionCodes: ["assets:read"],
};

interface HttpTestContext {
  readonly context: ExecutionContext;
  readonly request: AuthenticatedRequest;
  readonly response: { setHeader: jest.Mock };
}

function createHttpContext(authorizationHeader?: string): HttpTestContext {
  const request = {
    get: jest.fn((headerName: string) =>
      headerName === AUTH_HTTP_HEADER.AUTHORIZATION
        ? authorizationHeader
        : undefined,
    ),
  } as unknown as AuthenticatedRequest;
  const response = { setHeader: jest.fn() };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response as unknown as Response,
    }),
  } as unknown as ExecutionContext;

  return { context, request, response };
}

function createGuard() {
  const service = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<AuthenticateAccessTokenService>;

  return {
    guard: new AccessTokenGuard(service),
    service,
  };
}

describe("extractBearerAccessToken", () => {
  it.each([
    undefined,
    "",
    ACCESS_TOKEN,
    `Basic ${ACCESS_TOKEN}`,
    "Bearer",
    `Bearer ${ACCESS_TOKEN} trailing`,
  ])("rejects a missing or malformed authorization header", (header) => {
    try {
      extractBearerAccessToken(header);
      throw new Error("Expected the authorization header to be rejected");
    } catch (error) {
      expect(error).toMatchObject({
        code: APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID,
      });
    }
  });

  it("accepts a case-insensitive Bearer scheme", () => {
    expect(extractBearerAccessToken(`bearer ${ACCESS_TOKEN}`)).toBe(
      ACCESS_TOKEN,
    );
  });
});

describe("AccessTokenGuard", () => {
  it("attaches the authenticated identity to the request", async () => {
    const { guard, service } = createGuard();
    const http = createHttpContext(`Bearer ${ACCESS_TOKEN}`);
    service.execute.mockResolvedValue(AUTHENTICATED_IDENTITY);

    await expect(guard.canActivate(http.context)).resolves.toBe(true);

    expect(service.execute).toHaveBeenCalledWith(ACCESS_TOKEN);
    expect(http.request.authenticatedIdentity).toEqual(AUTHENTICATED_IDENTITY);
    expect(http.response.setHeader).not.toHaveBeenCalled();
  });

  it.each([
    APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID,
    APP_ERROR_CODE.AUTH_ACCESS_TOKEN_EXPIRED,
    APP_ERROR_CODE.AUTH_SESSION_INVALID,
    APP_ERROR_CODE.AUTH_SESSION_EXPIRED,
  ])("adds a Bearer challenge for %s", async (code) => {
    const { guard, service } = createGuard();
    const http = createHttpContext(`Bearer ${ACCESS_TOKEN}`);
    service.execute.mockRejectedValue(new AppError(code));

    await expect(guard.canActivate(http.context)).rejects.toMatchObject({
      code,
    });

    expect(http.response.setHeader).toHaveBeenCalledWith(
      AUTH_HTTP_HEADER.WWW_AUTHENTICATE,
      AUTH_TOKEN_TYPE.BEARER,
    );
  });

  it("does not convert an unexpected dependency failure into an authentication error", async () => {
    const { guard, service } = createGuard();
    const http = createHttpContext(`Bearer ${ACCESS_TOKEN}`);
    const databaseError = new Error("database unavailable");
    service.execute.mockRejectedValue(databaseError);

    await expect(guard.canActivate(http.context)).rejects.toBe(databaseError);
    expect(http.response.setHeader).not.toHaveBeenCalled();
  });
});
