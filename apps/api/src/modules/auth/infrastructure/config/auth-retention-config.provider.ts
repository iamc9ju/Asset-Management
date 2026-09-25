import type { FactoryProvider } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AUTH_RETENTION_CONFIG,
  type AuthRetentionConfig,
} from "../../application/config/auth-retention.config";

export function createAuthRetentionConfig(
  configService: ConfigService,
): AuthRetentionConfig {
  return {
    retentionSeconds: configService.getOrThrow<number>(
      "AUTH_SESSION_RETENTION_SECONDS",
    ),
    batchSize: configService.getOrThrow<number>("AUTH_CLEANUP_BATCH_SIZE"),
    maxBatches: configService.getOrThrow<number>("AUTH_CLEANUP_MAX_BATCHES"),
  };
}

export const authRetentionConfigProvider: FactoryProvider<AuthRetentionConfig> =
  {
    provide: AUTH_RETENTION_CONFIG,
    inject: [ConfigService],
    useFactory: createAuthRetentionConfig,
  };
