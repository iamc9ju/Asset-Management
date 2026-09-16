import "dotenv/config";
import { DataSource } from "typeorm";

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
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
  migrationsRun: false,
  logging: false,
});
