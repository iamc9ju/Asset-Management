import type { ConfigService } from "@nestjs/config";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";

export function databaseConfig(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: "postgres",
    url: config.getOrThrow<string>("DATABASE_URL"),
    poolSize: config.get<number>("DATABASE_POOL_SIZE", 10),
    extra: {
      enableChannelBinding: true,
    },
    autoLoadEntities: true,
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}
