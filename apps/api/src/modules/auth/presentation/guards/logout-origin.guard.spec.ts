import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AUTH_HTTP_HEADER } from "../../domain/auth.constants";
import type { AuthCookieService } from "../auth-cookie.service";
import { LogoutOriginGuard } from "./logout-origin.guard";

const TRUSTED_ORIGIN = "https://app.example.com";

function createGuard(refreshToken: string | null) {
  const configService = {
    getOrThrow: jest.fn(() => TRUSTED_ORIGIN),
  } as unknown as ConfigService;
  const authCookieService = {
    hasRefreshTokenCookie: jest.fn(() => refreshToken !== null),
  } as unknown as AuthCookieService;

  return new LogoutOriginGuard(configService, authCookieService);
}

function createContext(origin?: string): ExecutionContext {
  const request = {
    get: jest.fn((header: string) =>
      header === AUTH_HTTP_HEADER.ORIGIN ? origin : undefined,
    ),
  };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe("LogoutOriginGuard", () => {
  it("allows an idempotent logout without Origin when no refresh cookie exists", () => {
    expect(createGuard(null).canActivate(createContext())).toBe(true);
  });

  it("allows an exact trusted Origin when a refresh cookie exists", () => {
    expect(
      createGuard("token-id.token-secret").canActivate(
        createContext(TRUSTED_ORIGIN),
      ),
    ).toBe(true);
  });

  it.each([undefined, "", "https://attacker.example.com"])(
    "rejects Origin %p when a refresh cookie exists",
    (origin) => {
      try {
        createGuard("token-id.token-secret").canActivate(createContext(origin));
        throw new Error("Expected the Origin to be rejected");
      } catch (error) {
        expect(error).toMatchObject({ code: APP_ERROR_CODE.FORBIDDEN });
      }
    },
  );
});
