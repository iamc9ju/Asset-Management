import { Inject, Injectable } from "@nestjs/common";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import { PERMISSION_CODE } from "../../../iam/domain/permission-code";
import type { AuthenticatedIdentity } from "../../domain/authenticated-identity";
import { AUTH_SESSION_REVOKE_REASON } from "../../domain/auth.constants";
import type { AuthClientContext } from "../ports/auth-client-context.port";
import { CLOCK, type Clock } from "../ports/clock.port";
import {
  SESSION_MANAGEMENT_REPOSITORY,
  type SessionManagementRepository,
} from "../ports/session-management-repository.port";
import { assertCanManageTargetUser } from "./list-auth-sessions.service";

export interface RevokeAuthSessionCommand {
  readonly identity: AuthenticatedIdentity;
  readonly sessionId: string;
  readonly client: AuthClientContext;
}

export interface RevokeAuthSessionResult {
  readonly revokedCurrentSession: boolean;
}

@Injectable()
export class RevokeAuthSessionService {
  constructor(
    @Inject(SESSION_MANAGEMENT_REPOSITORY)
    private readonly sessionManagementRepository: SessionManagementRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async execute(
    command: RevokeAuthSessionCommand,
  ): Promise<RevokeAuthSessionResult> {
    const targetSession = await this.sessionManagementRepository.findById(
      command.sessionId,
    );

    if (!targetSession) {
      throw new AppError(APP_ERROR_CODE.RESOURCE_NOT_FOUND);
    }

    const isOwnSession = targetSession.userId === command.identity.userId;

    assertCanManageTargetUser(
      command.identity,
      targetSession.userId,
      PERMISSION_CODE.SESSION_REVOKE_ANY,
    );

    const found = await this.sessionManagementRepository.revokeById({
      sessionId: targetSession.sessionId,
      actorUserId: command.identity.userId,
      reason: isOwnSession
        ? AUTH_SESSION_REVOKE_REASON.USER_REVOKED_SESSION
        : AUTH_SESSION_REVOKE_REASON.ADMIN_REVOKED_SESSION,
      occurredAt: this.clock.now(),
      client: command.client,
    });

    if (!found) {
      throw new AppError(APP_ERROR_CODE.RESOURCE_NOT_FOUND);
    }

    return {
      revokedCurrentSession:
        targetSession.sessionId === command.identity.sessionId,
    };
  }
}
