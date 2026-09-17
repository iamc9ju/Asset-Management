import { Inject, Injectable } from "@nestjs/common";
import type { Response } from "express";
import {
  AUTH_SESSION_CONFIG,
  type AuthSessionConfig,
} from "../application/config/auth-session.config";
import { CLOCK, type Clock } from "../application/ports/clock.port";
import { AUTH_COOKIE } from "../domain/auth.constants";
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

  setRefreshToken(
    response: Response,
    rawToken: string,
    expiresAt: Date,
  ): void {
    response.cookie(this.refreshCookieName, rawToken, {
      httpOnly: true,
      secure: this.config.refreshCookieSecure,
      sameSite: AUTH_COOKIE.SAME_SITE,
      path: REFRESH_COOKIE_PATH,
      expires: expiresAt,
      maxAge: Math.max(0, expiresAt.getTime() - this.clock.now().getTime()),
    });
  }

  get refreshCookieName(): string {
    return this.config.refreshCookieSecure
      ? AUTH_COOKIE.SECURE_REFRESH_TOKEN_NAME
      : AUTH_COOKIE.DEVELOPMENT_REFRESH_TOKEN_NAME;
  }
}
