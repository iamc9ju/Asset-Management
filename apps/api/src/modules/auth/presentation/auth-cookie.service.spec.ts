import type { Request, Response } from "express";
import type { AuthSessionConfig } from "../application/config/auth-session.config";
import type { Clock } from "../application/ports/clock.port";
import { AUTH_COOKIE } from "../domain/auth.constants";
import { AuthCookieService, readCookie } from "./auth-cookie.service";

const NOW = new Date("2026-09-17T10:00:00.000Z");
const EXPIRES_AT = new Date("2026-09-17T11:00:00.000Z");

function createResponse(): { cookie: jest.Mock; clearCookie: jest.Mock } {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

function createRequest(cookieHeader?: string): Request {
  return {
    get: jest.fn(() => cookieHeader),
  } as unknown as Request;
}

function createService(refreshCookieSecure: boolean): AuthCookieService {
  const config: AuthSessionConfig = {
    idleTtlSeconds: 600,
    absoluteTtlSeconds: 3_600,
    refreshCookieSecure,
  };
  const clock: Clock = { now: () => new Date(NOW) };
  return new AuthCookieService(config, clock);
}

describe("AuthCookieService", () => {
  it("sets the prefixed Secure cookie for secure environments", () => {
    const service = createService(true);
    const response = createResponse();

    service.setRefreshToken(
      response as unknown as Response,
      "raw-refresh-token",
      EXPIRES_AT,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME,
      "raw-refresh-token",
      {
        httpOnly: true,
        secure: true,
        sameSite: AUTH_COOKIE.SAME_SITE,
        path: "/api/v1/auth",
        expires: EXPIRES_AT,
        maxAge: 3_600_000,
      },
    );
  });

  it("uses the unprefixed cookie name for local HTTP development", () => {
    const service = createService(false);
    const response = createResponse();

    service.setRefreshToken(
      response as unknown as Response,
      "raw-refresh-token",
      EXPIRES_AT,
    );

    expect(response.cookie).toHaveBeenCalledWith(
      AUTH_COOKIE.DEVELOPMENT_REFRESH_TOKEN_NAME,
      "raw-refresh-token",
      expect.objectContaining({ secure: false }),
    );
  });

  it("reads only the configured refresh cookie", () => {
    const service = createService(true);
    const request = createRequest(
      `unrelated=value; ${AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME}=token-id.token-secret`,
    );

    expect(service.readRefreshToken(request)).toBe("token-id.token-secret");
  });

  it("clears the cookie with the same security scope used when setting it", () => {
    const service = createService(true);
    const response = createResponse();

    service.clearRefreshToken(response as unknown as Response);

    expect(response.clearCookie).toHaveBeenCalledWith(
      AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME,
      {
        httpOnly: true,
        secure: true,
        sameSite: AUTH_COOKIE.SAME_SITE,
        path: "/api/v1/auth",
      },
    );
  });
});

describe("readCookie", () => {
  it("decodes a single matching cookie value", () => {
    expect(readCookie("am_refresh=token%2Esecret", "am_refresh")).toBe(
      "token.secret",
    );
  });

  it.each([
    undefined,
    "",
    "another_cookie=value",
    "am_refresh=",
    "am_refresh=%E0%A4%A",
    "am_refresh=first; am_refresh=second",
  ])(
    "rejects an absent, empty, malformed, or ambiguous cookie %p",
    (header) => {
      expect(readCookie(header, "am_refresh")).toBeNull();
    },
  );
});
