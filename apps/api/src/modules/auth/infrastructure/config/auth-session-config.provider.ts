import type { FactoryProvider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AUTH_SESSION_CONFIG,
  type AuthSessionConfig,
} from "../../application/config/auth-session.config";

export function createAuthSessionConfig(
  configService: ConfigService,
): AuthSessionConfig {
  return {
    idleTtlSeconds: configService.getOrThrow<number>(
      "AUTH_SESSION_IDLE_TTL_SECONDS",
    ),
    absoluteTtlSeconds: configService.getOrThrow<number>(
      "AUTH_SESSION_ABSOLUTE_TTL_SECONDS",
    ),
    refreshCookieSecure: configService.getOrThrow<boolean>(
      "AUTH_REFRESH_COOKIE_SECURE",
    ),
  };
}

export const authSessionConfigProvider: FactoryProvider<AuthSessionConfig> = {
  provide: AUTH_SESSION_CONFIG,
  inject: [ConfigService],
  useFactory: createAuthSessionConfig,
};
