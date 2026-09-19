import "dotenv/config";
import type { DataSource } from "typeorm";
import { Argon2PasswordHasher } from "../../modules/auth/infrastructure/crypto/argon2-password-hasher";
import { UuidIdentifierGenerator } from "../../modules/auth/infrastructure/crypto/uuid-identifier-generator";
import { SystemClock } from "../../modules/auth/infrastructure/time/system-clock";
import {
  BootstrapAdministratorCommandError,
  BootstrapAdministratorInputError,
} from "./bootstrap-administrator.error";
import {
  BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE,
  parseBootstrapAdministratorInput,
  readBootstrapAdministratorPassword,
} from "./bootstrap-administrator.input";
import { bootstrapAdministrator } from "./bootstrap-administrator";

const COMMAND_NAME = "bootstrap:administrator";

async function run(): Promise<void> {
  if (process.argv.slice(2).length > 0) {
    throw new BootstrapAdministratorInputError(
      `${COMMAND_NAME} does not accept command-line arguments. Configure ${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL} and ${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.DISPLAY_NAME}, then pipe the password through standard input.`,
    );
  }

  const password = await readBootstrapAdministratorPassword(process.stdin);
  const input = parseBootstrapAdministratorInput(process.env, password);
  const { default: dataSource } =
    (await import("../../config/typeorm-cli.config")) as {
      default: DataSource;
    };

  try {
    await dataSource.initialize();
    const result = await bootstrapAdministrator(
      dataSource,
      {
        clock: new SystemClock(),
        identifierGenerator: new UuidIdentifierGenerator(),
        passwordHasher: new Argon2PasswordHasher(),
      },
      input,
    );

    process.stdout.write(
      `Bootstrap administrator ${result.status}; user ID: ${result.userId}\n`,
    );
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void run().catch((error: unknown) => {
  const message =
    error instanceof BootstrapAdministratorCommandError
      ? error.message
      : "Bootstrap administrator command failed unexpectedly.";

  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
