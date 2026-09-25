import "dotenv/config";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import type { DataSource } from "typeorm";
import { validateEnvironment } from "../../config/environment.schema";
import { CleanupAuthRetentionService } from "../../modules/auth/application/services/cleanup-auth-retention.service";
import { createAuthRetentionConfig } from "../../modules/auth/infrastructure/config/auth-retention-config.provider";
import { SystemClock } from "../../modules/auth/infrastructure/time/system-clock";
import { TypeOrmAuthEventRepository } from "../../modules/auth/infrastructure/typeorm/auth-event.repository";
import { TypeOrmAuthRetentionRepository } from "../../modules/auth/infrastructure/typeorm/auth-retention.repository";

const COMMAND_NAME = "cleanup:auth-retention";
const DRY_RUN_ARGUMENT = "--dry-run";

function parseDryRun(arguments_: readonly string[]): boolean {
  if (arguments_.length === 0) {
    return false;
  }

  if (arguments_.length === 1 && arguments_[0] === DRY_RUN_ARGUMENT) {
    return true;
  }

  throw new Error(`${COMMAND_NAME} accepts only ${DRY_RUN_ARGUMENT}.`);
}

async function run(): Promise<void> {
  const dryRun = parseDryRun(process.argv.slice(2));
  const environment = validateEnvironment(process.env);
  const configService = new ConfigService(environment);
  const config = createAuthRetentionConfig(configService);
  const { default: dataSource } = (await import(
    "../../config/typeorm-cli.config"
  )) as { default: DataSource };

  try {
    await dataSource.initialize();
    const service = new CleanupAuthRetentionService(
      new TypeOrmAuthRetentionRepository(dataSource),
      new TypeOrmAuthEventRepository(dataSource),
      new SystemClock(),
      config,
    );

    if (dryRun) {
      const result = await service.preview();
      process.stdout.write(
        `${JSON.stringify({ mode: "dry-run", ...result })}\n`,
      );
      return;
    }

    const result = await service.execute({
      client: {
        requestId: randomUUID(),
        ipAddress: null,
        userAgent: null,
      },
    });
    process.stdout.write(`${JSON.stringify({ mode: "cleanup", ...result })}\n`);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run().catch((error: unknown) => {
  const message =
    error instanceof Error && error.message.startsWith(COMMAND_NAME)
      ? error.message
      : "Authentication retention cleanup failed unexpectedly.";

  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
