import { Inject, Injectable } from "@nestjs/common";
import {
  ACCESS_TOKEN_CONFIG,
  type AccessTokenConfig,
} from "../config/access-token.config";
import {
  AUTH_SESSION_CONFIG,
  type AuthSessionConfig,
} from "../config/auth-session.config";
import {
  AUTH_EVENT_REPOSITORY,
  LOGIN_FAILURE_REASON,
  type AuthEventRepository,
  type LoginFailureReason,
} from "../ports/auth-event.port";
import {
  AUTH_SESSION_REPOSITORY,
  CREATE_LOGIN_SESSION_RESULT,
  type AuthSessionRepository,
} from "../ports/auth-session-repository.port";
import type { AuthClientContext } from "../ports/auth-client-context.port";
import {
  ACCESS_TOKEN_SERVICE,
  type AccessTokenService,
} from "../ports/access-token.port";
import { CLOCK, type Clock } from "../ports/clock.port";
import {
  IDENTIFIER_GENERATOR,
  type IdentifierGenerator,
} from "../ports/identifier-generator.port";
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from "../ports/password-hasher.port";
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from "../ports/refresh-token.port";
import {
  IAM_AUTH_QUERY,
  type IamAuthQuery,
  type IamAuthenticationUser,
} from "../../../iam/application/ports/iam-auth-query.port";
import { USER_STATUS } from "../../../iam/domain/user-status";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import { AUTH_TOKEN_TYPE } from "../../domain/auth.constants";
import { calculateInitialSessionExpiration } from "../../domain/session-policy";

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
  readonly deviceLabel?: string;
  readonly client: AuthClientContext;
}

export interface LoginResult {
  readonly accessToken: string;
  readonly tokenType: typeof AUTH_TOKEN_TYPE.BEARER;
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

@Injectable()
export class LoginService {
  constructor(
    @Inject(IAM_AUTH_QUERY)
    private readonly iamAuthQuery: IamAuthQuery,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: RefreshTokenService,
    @Inject(AUTH_SESSION_REPOSITORY)
    private readonly authSessionRepository: AuthSessionRepository,
    @Inject(AUTH_EVENT_REPOSITORY)
    private readonly authEventRepository: AuthEventRepository,
    @Inject(IDENTIFIER_GENERATOR)
    private readonly identifierGenerator: IdentifierGenerator,
    @Inject(CLOCK)
    private readonly clock: Clock,
    @Inject(ACCESS_TOKEN_CONFIG)
    private readonly accessTokenConfig: AccessTokenConfig,
    @Inject(AUTH_SESSION_CONFIG)
    private readonly authSessionConfig: AuthSessionConfig,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const normalizedEmail = normalizeEmail(command.email);
    const user =
      await this.iamAuthQuery.findAuthenticationUserByEmail(normalizedEmail);
    const passwordMatches = await this.verifyCredential(user, command.password);

    if (!user) {
      return this.rejectLogin(
        null,
        LOGIN_FAILURE_REASON.UNKNOWN_IDENTITY,
        command.client,
      );
    }

    if (!passwordMatches) {
      return this.rejectLogin(
        user.id,
        LOGIN_FAILURE_REASON.INVALID_PASSWORD,
        command.client,
      );
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      return this.rejectLogin(
        user.id,
        LOGIN_FAILURE_REASON.ACCOUNT_NOT_ACTIVE,
        command.client,
      );
    }

    const occurredAt = this.clock.now();
    const sessionId = this.identifierGenerator.generate();
    const refreshToken = this.refreshTokenService.issue();
    const expiration = calculateInitialSessionExpiration(
      occurredAt,
      this.authSessionConfig,
    );
    const accessToken = await this.accessTokenService.issue({
      userId: user.id,
      sessionId,
    });
    const result = await this.authSessionRepository.createLoginSession({
      sessionId,
      userId: user.id,
      deviceLabel: normalizeDeviceLabel(command.deviceLabel),
      idleExpiresAt: expiration.idleExpiresAt,
      absoluteExpiresAt: expiration.absoluteExpiresAt,
      refreshTokenId: refreshToken.tokenId,
      refreshTokenHash: refreshToken.tokenHash,
      occurredAt,
      client: command.client,
    });

    if (result === CREATE_LOGIN_SESSION_RESULT.USER_NOT_ACTIVE) {
      return this.rejectLogin(
        user.id,
        LOGIN_FAILURE_REASON.ACCOUNT_NOT_ACTIVE,
        command.client,
        occurredAt,
      );
    }

    return {
      accessToken,
      tokenType: AUTH_TOKEN_TYPE.BEARER,
      expiresIn: this.accessTokenConfig.ttlSeconds,
      refreshToken: refreshToken.rawToken,
      refreshTokenExpiresAt: expiration.absoluteExpiresAt,
    };
  }

  private async verifyCredential(
    user: IamAuthenticationUser | null,
    password: string,
  ): Promise<boolean> {
    if (!user) {
      await this.passwordHasher.consumeVerificationCost(password);
      return false;
    }

    return this.passwordHasher.verify(user.passwordHash, password);
  }

  private async rejectLogin(
    targetUserId: string | null,
    reason: LoginFailureReason,
    client: AuthClientContext,
    occurredAt = this.clock.now(),
  ): Promise<never> {
    await this.authEventRepository.recordLoginFailure({
      targetUserId,
      reason,
      occurredAt,
      client,
    });

    throw new AppError(APP_ERROR_CODE.AUTH_INVALID_CREDENTIALS);
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDeviceLabel(deviceLabel: string | undefined): string | null {
  const normalized = deviceLabel?.trim();
  return normalized ? normalized : null;
}
