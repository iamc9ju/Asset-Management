import { Inject, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  AUTH_SESSION_CONFIG,
  type AuthSessionConfig,
} from "../application/config/auth-session.config";
import { CLOCK, type Clock } from "../application/ports/clock.port";
import { AUTH_COOKIE, AUTH_HTTP_HEADER } from "../domain/auth.constants";
import {
  API_GLOBAL_PREFIX,
  API_ROUTE,
} from "../../../shared/http/api-route.constants";

const REFRESH_COOKIE_PATH = `/${API_GLOBAL_PREFIX}/${API_ROUTE.AUTH.BASE}`;

@Injectable()
export class AuthCookieService {
  constructor(
    @Inject(AUTH_SESSION_CONFIG)
    private readonly config: AuthSessionConfig,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  setRefreshToken(response: Response, rawToken: string, expiresAt: Date): void {
    response.cookie(this.refreshCookieName, rawToken, {
      httpOnly: true,
      secure: this.config.refreshCookieSecure,
      sameSite: AUTH_COOKIE.SAME_SITE,
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
      maxAge: Math.max(0, expiresAt.getTime() - this.clock.now().getTime()),
    });
  }

  readRefreshToken(request: Request): string | null {
    return readCookie(
      request.get(AUTH_HTTP_HEADER.COOKIE),
      this.refreshCookieName,
    );
  }

  clearRefreshToken(response: Response): void {
    response.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: this.config.refreshCookieSecure,
      sameSite: AUTH_COOKIE.SAME_SITE,
      path: REFRESH_COOKIE_PATH,
    });
  }

  get refreshCookieName(): string {
    return this.config.refreshCookieSecure
      ? AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME
      : AUTH_COOKIE.DEVELOPMENT_REFRESH_TOKEN_NAME;
  }
}

export function readCookie(
  cookieHeader: string | undefined,
  cookieName: string,
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const values: string[] = [];

  for (const segment of cookieHeader.split(";")) {
    const separatorIndex = segment.indexOf("=");

    if (separatorIndex < 0) {
      continue;
    }

    const name = segment.slice(0, separatorIndex).trim();
    if (name !== cookieName) {
      continue;
    }

    try {
      values.push(decodeURIComponent(segment.slice(separatorIndex + 1).trim()));
    } catch {
      return null;
    }
  }

  return values.length === 1 && values[0] ? values[0] : null;
}
