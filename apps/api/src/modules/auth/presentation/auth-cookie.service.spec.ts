import type { Response } from "express";
import type { AuthSessionConfig } from "../application/config/auth-session.config";
import type { Clock } from "../application/ports/clock.port";
import { AUTH_COOKIE } from "../domain/auth.constants";
import { AuthCookieService } from "./auth-cookie.service";

const NOW = new Date("2026-09-17T10:00:00.000Z");
const EXPIRES_AT = new Date("2026-09-17T11:00:00.000Z");

function createResponse(): { cookie: jest.Mock } {
  return {
    cookie: jest.fn(),
  };
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
});
