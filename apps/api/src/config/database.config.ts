import type { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";

export function databaseConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: "postgres",
    host: config.get("POSTGRES_HOST", "localhost"),
    port: config.getOrThrow<number>("POSTGRES_PORT"),
    database: config.get("POSTGRES_DB", "asset_management"),
    username: config.get("POSTGRES_USER", "asset_app"),
    password: config.get("POSTGRES_PASSWORD", "asset_dev_password"),
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    logging: config.get("NODE_ENV") === "development",
  };
}
