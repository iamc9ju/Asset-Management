import { Inject, Injectable } from "@nestjs/common";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import {
  IAM_AUTH_QUERY,
  type IamAuthQuery,
} from "../../../iam/application/ports/iam-auth-query.port";
import { USER_STATUS } from "../../../iam/domain/user-status";
import type { AuthenticatedIdentity } from "../../domain/authenticated-identity";
import {
  ACCESS_TOKEN_SERVICE,
  type AccessTokenService,
} from "../ports/access-token.port";
import {
  AUTH_SESSION_QUERY,
  type AuthSessionQuery,
  type AuthSessionState,
} from "../ports/auth-session-query.port";
import { CLOCK, type Clock } from "../ports/clock.port";

@Injectable()
export class AuthenticateAccessTokenService {
  constructor(
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,
    @Inject(AUTH_SESSION_QUERY)
    private readonly authSessionQuery: AuthSessionQuery,
    @Inject(IAM_AUTH_QUERY)
    private readonly iamAuthQuery: IamAuthQuery,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async execute(accessToken: string): Promise<AuthenticatedIdentity> {
    const verification = await this.accessTokenService.verify(accessToken);

    if (!verification.valid) {
      throw new AppError(
        verification.reason === "expired"
          ? APP_ERROR_CODE.AUTH_ACCESS_TOKEN_EXPIRED
          : APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID,
      );
    }

    const { userId, sessionId } = verification.claims;
    const [session, user] = await Promise.all([
      this.authSessionQuery.findByIdAndUserId(sessionId, userId),
      this.iamAuthQuery.findAuthorizationContextByUserId(userId),
    ]);

    if (
      !session ||
      session.sessionId !== sessionId ||
      session.userId !== userId ||
      session.revokedAt
    ) {
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_INVALID);
    }

    if (!user || user.userId !== userId || user.status !== USER_STATUS.ACTIVE) {
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_INVALID);
    }

    if (isSessionExpired(session, this.clock.now())) {
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_EXPIRED);
    }

    return Object.freeze({
      userId: user.userId,
      sessionId: session.sessionId,
      displayName: user.displayName,
      status: USER_STATUS.ACTIVE,
      permissionVersion: user.permissionVersion,
      permissionCodes: Object.freeze([...user.permissionCodes]),
    });
  }
}

function isSessionExpired(session: AuthSessionState, now: Date): boolean {
  const nowTimestamp = now.getTime();

  return (
    session.idleExpiresAt.getTime() <= nowTimestamp ||
    session.absoluteExpiresAt.getTime() <= nowTimestamp
  );
}
