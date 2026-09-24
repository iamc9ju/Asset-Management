import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { IamModule } from "../iam/iam.module";
import { ACCESS_TOKEN_SERVICE } from "./application/ports/access-token.port";
import { AUTH_EVENT_REPOSITORY } from "./application/ports/auth-event.port";
import { AUTH_SESSION_QUERY } from "./application/ports/auth-session-query.port";
import { AUTH_SESSION_REPOSITORY } from "./application/ports/auth-session-repository.port";
import { REFRESH_SESSION_REPOSITORY } from "./application/ports/refresh-session-repository.port";
import { SESSION_MANAGEMENT_REPOSITORY } from "./application/ports/session-management-repository.port";
import { CLOCK } from "./application/ports/clock.port";
import { IDENTIFIER_GENERATOR } from "./application/ports/identifier-generator.port";
import { PASSWORD_HASHER } from "./application/ports/password-hasher.port";
import { REFRESH_TOKEN_SERVICE } from "./application/ports/refresh-token.port";
import { AuthenticateAccessTokenService } from "./application/services/authenticate-access-token.service";
import { LoginService } from "./application/services/login.service";
import { ListAuthSessionsService } from "./application/services/list-auth-sessions.service";
import { LogoutService } from "./application/services/logout.service";
import { RefreshSessionService } from "./application/services/refresh-session.service";
import { RevokeAllAuthSessionsService } from "./application/services/revoke-all-auth-sessions.service";
import { RevokeAuthSessionService } from "./application/services/revoke-auth-session.service";
import { accessTokenConfigProvider } from "./infrastructure/config/access-token-config.provider";
import { authSessionConfigProvider } from "./infrastructure/config/auth-session-config.provider";
import { Argon2PasswordHasher } from "./infrastructure/crypto/argon2-password-hasher";
import { JwtAccessTokenService } from "./infrastructure/crypto/jwt-access-token.service";
import { OpaqueRefreshTokenService } from "./infrastructure/crypto/opaque-refresh-token.service";
import { UuidIdentifierGenerator } from "./infrastructure/crypto/uuid-identifier-generator";
import { SystemClock } from "./infrastructure/time/system-clock";
import { TypeOrmAuthEventRepository } from "./infrastructure/typeorm/auth-event.repository";
import { TypeOrmAuthSessionQueryRepository } from "./infrastructure/typeorm/auth-session-query.repository";
import { TypeOrmAuthSessionRepository } from "./infrastructure/typeorm/auth-session.repository";
import { TypeOrmRefreshSessionRepository } from "./infrastructure/typeorm/refresh-session.repository";
import { TypeOrmSessionManagementRepository } from "./infrastructure/typeorm/session-management.repository";
import { AuthRefreshTokenOrmEntity } from "./infrastructure/typeorm/entities/auth-refresh-token.orm-entity";
import { AuthSessionOrmEntity } from "./infrastructure/typeorm/entities/auth-session.orm-entity";
import { AuthController } from "./presentation/auth.controller";
import { AuthCookieService } from "./presentation/auth-cookie.service";
import { AccessTokenGuard } from "./presentation/guards/access-token.guard";
import { AuthOriginGuard } from "./presentation/guards/auth-origin.guard";
import { LogoutOriginGuard } from "./presentation/guards/logout-origin.guard";
import { PermissionGuard } from "./presentation/guards/permission.guard";

@Module({
  imports: [
    IamModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([AuthSessionOrmEntity, AuthRefreshTokenOrmEntity]),
  ],
  controllers: [AuthController],
  providers: [
    accessTokenConfigProvider,
    authSessionConfigProvider,
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
    {
      provide: IDENTIFIER_GENERATOR,
      useClass: UuidIdentifierGenerator,
    },
    {
      provide: AUTH_SESSION_REPOSITORY,
      useClass: TypeOrmAuthSessionRepository,
    },
    {
      provide: REFRESH_SESSION_REPOSITORY,
      useClass: TypeOrmRefreshSessionRepository,
    },
    {
      provide: SESSION_MANAGEMENT_REPOSITORY,
      useClass: TypeOrmSessionManagementRepository,
    },
    {
      provide: AUTH_SESSION_QUERY,
      useClass: TypeOrmAuthSessionQueryRepository,
    },
    {
      provide: AUTH_EVENT_REPOSITORY,
      useClass: TypeOrmAuthEventRepository,
    },
    LoginService,
    RefreshSessionService,
    LogoutService,
    ListAuthSessionsService,
    RevokeAuthSessionService,
    RevokeAllAuthSessionsService,
    AuthenticateAccessTokenService,
    AuthCookieService,
    AccessTokenGuard,
    AuthOriginGuard,
    LogoutOriginGuard,
    PermissionGuard,
  ],
  exports: [
    CLOCK,
    PASSWORD_HASHER,
    ACCESS_TOKEN_SERVICE,
    REFRESH_TOKEN_SERVICE,
    AccessTokenGuard,
    PermissionGuard,
  ],
})
export class AuthModule {}
