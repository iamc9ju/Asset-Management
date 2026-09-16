import type { FactoryProvider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  ACCESS_TOKEN_CONFIG,
  type AccessTokenConfig,
} from "../../application/config/access-token.config";

export function createAccessTokenConfig(
  configService: ConfigService,
): AccessTokenConfig {
  const previousKeyId = configService.get<string>("AUTH_JWT_PREVIOUS_KID");
  const previousKeySecret = configService.get<string>(
    "AUTH_JWT_PREVIOUS_SECRET",
  );

  return {
    issuer: configService.getOrThrow<string>("AUTH_JWT_ISSUER"),
    audience: configService.getOrThrow<string>("AUTH_JWT_AUDIENCE"),
    ttlSeconds: configService.getOrThrow<number>(
      "AUTH_ACCESS_TOKEN_TTL_SECONDS",
    ),
    currentKey: {
      id: configService.getOrThrow<string>("AUTH_JWT_CURRENT_KID"),
      secret: configService.getOrThrow<string>("AUTH_JWT_CURRENT_SECRET"),
    },
    previousKey:
      previousKeyId && previousKeySecret
        ? {
            id: previousKeyId,
            secret: previousKeySecret,
          }
        : undefined,
  };
}

export const accessTokenConfigProvider: FactoryProvider<AccessTokenConfig> = {
  provide: ACCESS_TOKEN_CONFIG,
  inject: [ConfigService],
  useFactory: createAccessTokenConfig,
};
