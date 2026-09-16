import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IamModule } from "../iam/iam.module";
import { ACCESS_TOKEN_SERVICE } from "./application/ports/access-token.port";
import { CLOCK } from "./application/ports/clock.port";
import { PASSWORD_HASHER } from "./application/ports/password-hasher.port";
import { REFRESH_TOKEN_SERVICE } from "./application/ports/refresh-token.port";
import { accessTokenConfigProvider } from "./infrastructure/config/access-token-config.provider";
import { Argon2PasswordHasher } from "./infrastructure/crypto/argon2-password-hasher";
import { JwtAccessTokenService } from "./infrastructure/crypto/jwt-access-token.service";
import { OpaqueRefreshTokenService } from "./infrastructure/crypto/opaque-refresh-token.service";
import { SystemClock } from "./infrastructure/time/system-clock";
import { AuthRefreshTokenOrmEntity } from "./infrastructure/typeorm/entities/auth-refresh-token.orm-entity";
import { AuthSessionOrmEntity } from "./infrastructure/typeorm/entities/auth-session.orm-entity";

@Module({
  imports: [
    IamModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([AuthSessionOrmEntity, AuthRefreshTokenOrmEntity]),
  ],
  providers: [
    accessTokenConfigProvider,
    {
      provide: CLOCK,
      useClass: SystemClock,
    },
    {
      provide: PASSWORD_HASHER,
      useClass: Argon2PasswordHasher,
    },
    {
      provide: ACCESS_TOKEN_SERVICE,
      useClass: JwtAccessTokenService,
    },
    {
      provide: REFRESH_TOKEN_SERVICE,
      useClass: OpaqueRefreshTokenService,
    },
  ],
  exports: [
    CLOCK,
    PASSWORD_HASHER,
    ACCESS_TOKEN_SERVICE,
    REFRESH_TOKEN_SERVICE,
  ],
})
export class AuthModule {}
