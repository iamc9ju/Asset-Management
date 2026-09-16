import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";
import { databaseConfig } from "./config/database.config";
import { validateEnvironment } from "./config/environment.schema";
import { AuthModule } from "./modules/auth/auth.module";
import { IamModule } from "./modules/iam/iam.module";
import { HealthModule } from "./modules/health/health.module";
import { GlobalExceptionFilter } from "./shared/http/errors/global-exception.filter";
import { InfrastructureModule } from "./shared/infrastructure/infrastructure.module";
import { LoggingModule } from "./shared/logging/logging.module";
import { ApplicationLifecycleLogger } from "./shared/logging/application-lifecycle.logger";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    LoggingModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: databaseConfig,
    }),
    InfrastructureModule,
    IamModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
