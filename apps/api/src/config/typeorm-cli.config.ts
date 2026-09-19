import "dotenv/config";
import { DataSource } from "typeorm";

export const TYPEORM_CLI_MIGRATION_GLOB = "src/database/migrations/[0-9]*-*.ts";

const databaseUrl =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL must be configured for TypeORM CLI",
  );
}

export default new DataSource({
  type: "postgres",
  url: databaseUrl,
  poolSize: 1,
  extra: {
    enableChannelBinding: true,
  },
  entities: ["src/**/*.orm-entity.ts", "src/**/*.entity.ts"],
  migrations: [TYPEORM_CLI_MIGRATION_GLOB],
  synchronize: false,
  migrationsRun: false,
  logging: false,
});
