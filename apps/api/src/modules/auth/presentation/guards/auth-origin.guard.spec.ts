import type { ExecutionContext } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AUTH_HTTP_HEADER } from "../../domain/auth.constants";
import { AuthOriginGuard } from "./auth-origin.guard";

const TRUSTED_ORIGIN = "https://app.example.com";

function createGuard() {
  const configService = {
    getOrThrow: jest.fn(() => TRUSTED_ORIGIN),
  } as unknown as ConfigService;

  return new AuthOriginGuard(configService);
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

describe("AuthOriginGuard", () => {
  it("allows an exact trusted Origin", () => {
    expect(createGuard().canActivate(createContext(TRUSTED_ORIGIN))).toBe(true);
  });

  it.each([
    undefined,
    "",
    "https://attacker.example.com",
    "https://app.example.com.evil.example",
    "https://app.example.com/",
  ])("rejects an absent or untrusted Origin %p", (origin) => {
    try {
      createGuard().canActivate(createContext(origin));
      throw new Error("Expected the Origin to be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: APP_ERROR_CODE.FORBIDDEN });
    }
  });
});
