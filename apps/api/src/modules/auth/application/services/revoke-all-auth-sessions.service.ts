import { Inject, Injectable } from "@nestjs/common";
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

export interface RevokeAllAuthSessionsCommand {
  readonly identity: AuthenticatedIdentity;
  readonly targetUserId?: string;
  readonly client: AuthClientContext;
}

export interface RevokeAllAuthSessionsResult {
  readonly revokedCurrentSession: boolean;
}

@Injectable()
export class RevokeAllAuthSessionsService {
  constructor(
    @Inject(SESSION_MANAGEMENT_REPOSITORY)
    private readonly sessionManagementRepository: SessionManagementRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async execute(
    command: RevokeAllAuthSessionsCommand,
  ): Promise<RevokeAllAuthSessionsResult> {
    const targetUserId = command.targetUserId ?? command.identity.userId;
    const isOwnUser = targetUserId === command.identity.userId;

    assertCanManageTargetUser(
      command.identity,
      targetUserId,
      PERMISSION_CODE.SESSION_REVOKE_ANY,
    );

    await this.sessionManagementRepository.revokeAllByUserId({
      userId: targetUserId,
      actorUserId: command.identity.userId,
      reason: isOwnUser
        ? AUTH_SESSION_REVOKE_REASON.USER_REVOKED_ALL_SESSIONS
        : AUTH_SESSION_REVOKE_REASON.ADMIN_REVOKED_ALL_SESSIONS,
      occurredAt: this.clock.now(),
      client: command.client,
    });

    return { revokedCurrentSession: isOwnUser };
  }
}
