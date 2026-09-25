import type { FactoryProvider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AUTH_RATE_LIMIT_CONFIG,
  type AuthRateLimitConfig,
} from "../../application/config/auth-rate-limit.config";
import { AUTH_RATE_LIMIT_POLICY } from "../../domain/auth-rate-limit-policy";

export function createAuthRateLimitConfig(
  configService: ConfigService,
): AuthRateLimitConfig {
  const loginWindowSeconds = configService.getOrThrow<number>(
    "AUTH_LOGIN_RATE_WINDOW_SECONDS",
  );
  const refreshWindowSeconds = configService.getOrThrow<number>(
    "AUTH_REFRESH_RATE_WINDOW_SECONDS",
  );

  return {
    namespace: configService.getOrThrow<string>("AUTH_RATE_LIMIT_NAMESPACE"),
    keySecret: configService.getOrThrow<string>(
      "AUTH_RATE_LIMIT_KEY_SECRET",
    ),
    policies: {
      [AUTH_RATE_LIMIT_POLICY.LOGIN_IP]: {
        capacity: configService.getOrThrow<number>(
          "AUTH_LOGIN_IP_RATE_LIMIT",
        ),
        windowSeconds: loginWindowSeconds,
      },
      [AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT]: {
        capacity: configService.getOrThrow<number>("AUTH_LOGIN_RATE_LIMIT"),
        windowSeconds: loginWindowSeconds,
      },
      [AUTH_RATE_LIMIT_POLICY.REFRESH_IP]: {
        capacity: configService.getOrThrow<number>(
          "AUTH_REFRESH_IP_RATE_LIMIT",
        ),
        windowSeconds: refreshWindowSeconds,
      },
      [AUTH_RATE_LIMIT_POLICY.REFRESH_TOKEN]: {
        capacity: configService.getOrThrow<number>("AUTH_REFRESH_RATE_LIMIT"),
        windowSeconds: refreshWindowSeconds,
      },
    },
  };
}

export const authRateLimitConfigProvider: FactoryProvider<AuthRateLimitConfig> =
  {
    provide: AUTH_RATE_LIMIT_CONFIG,
    inject: [ConfigService],
    useFactory: createAuthRateLimitConfig,
  };
