import { Inject, Injectable } from "@nestjs/common";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import { AUTH_TOKEN_TYPE } from "../../domain/auth.constants";
import {
  ACCESS_TOKEN_CONFIG,
  type AccessTokenConfig,
} from "../config/access-token.config";
import {
  AUTH_SESSION_CONFIG,
  type AuthSessionConfig,
} from "../config/auth-session.config";
import {
  ACCESS_TOKEN_SERVICE,
  type AccessTokenService,
} from "../ports/access-token.port";
import type { AuthClientContext } from "../ports/auth-client-context.port";
import { CLOCK, type Clock } from "../ports/clock.port";
import {
  REFRESH_SESSION_REPOSITORY,
  ROTATE_REFRESH_SESSION_RESULT,
  type RefreshSessionRepository,
} from "../ports/refresh-session-repository.port";
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from "../ports/refresh-token.port";
import { AuthRateLimitService } from "./auth-rate-limit.service";

export interface RefreshSessionCommand {
  readonly rawRefreshToken: string;
  readonly client: AuthClientContext;
}

export interface RefreshSessionResult {
  readonly accessToken: string;
  readonly tokenType: typeof AUTH_TOKEN_TYPE.BEARER;
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
}

@Injectable()
export class RefreshSessionService {
  constructor(
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: RefreshTokenService,
    @Inject(REFRESH_SESSION_REPOSITORY)
    private readonly refreshSessionRepository: RefreshSessionRepository,
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,
    @Inject(CLOCK)
    private readonly clock: Clock,
    @Inject(ACCESS_TOKEN_CONFIG)
    private readonly accessTokenConfig: AccessTokenConfig,
    @Inject(AUTH_SESSION_CONFIG)
    private readonly authSessionConfig: AuthSessionConfig,
    private readonly authRateLimitService: AuthRateLimitService,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<RefreshSessionResult> {
    await this.authRateLimitService.assertRefreshIpAllowed(command.client);
    const presentedToken = this.refreshTokenService.parseAndHash(
      command.rawRefreshToken,
    );

    if (!presentedToken) {
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_INVALID);
    }

    await this.authRateLimitService.assertRefreshTokenAllowed(
      presentedToken.tokenId,
      command.client,
    );

    const replacementToken = this.refreshTokenService.issue();
    const rotation = await this.refreshSessionRepository.rotate({
      currentTokenId: presentedToken.tokenId,
      currentTokenHash: presentedToken.tokenHash,
      replacementTokenId: replacementToken.tokenId,
      replacementTokenHash: replacementToken.tokenHash,
      idleTtlSeconds: this.authSessionConfig.idleTtlSeconds,
      occurredAt: this.clock.now(),
      client: command.client,
    });

    if (rotation.status === ROTATE_REFRESH_SESSION_RESULT.EXPIRED) {
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_EXPIRED);
    }

    if (rotation.status !== ROTATE_REFRESH_SESSION_RESULT.ROTATED) {
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_INVALID);
    }

    const accessToken = await this.accessTokenService.issue({
      userId: rotation.userId,
      sessionId: rotation.sessionId,
    });

    return {
      accessToken,
      tokenType: AUTH_TOKEN_TYPE.BEARER,
      expiresIn: this.accessTokenConfig.ttlSeconds,
      refreshToken: replacementToken.rawToken,
      refreshTokenExpiresAt: rotation.refreshTokenExpiresAt,
    };
  }
}
