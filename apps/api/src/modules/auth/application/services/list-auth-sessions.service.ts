import { Inject, Injectable } from "@nestjs/common";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import {
  PERMISSION_CODE,
  type PermissionCode,
} from "../../../iam/domain/permission-code";
import type { AuthenticatedIdentity } from "../../domain/authenticated-identity";
import { CLOCK, type Clock } from "../ports/clock.port";
import {
  SESSION_MANAGEMENT_REPOSITORY,
  type ManagedAuthSession,
  type SessionManagementRepository,
} from "../ports/session-management-repository.port";

export interface ListAuthSessionsQuery {
  readonly identity: AuthenticatedIdentity;
  readonly targetUserId?: string;
}

export interface ListedAuthSession extends ManagedAuthSession {
  readonly isCurrent: boolean;
}

@Injectable()
export class ListAuthSessionsService {
  constructor(
    @Inject(SESSION_MANAGEMENT_REPOSITORY)
    private readonly sessionManagementRepository: SessionManagementRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async execute(
    query: ListAuthSessionsQuery,
  ): Promise<readonly ListedAuthSession[]> {
    const targetUserId = query.targetUserId ?? query.identity.userId;

    assertCanManageTargetUser(
      query.identity,
      targetUserId,
      PERMISSION_CODE.SESSION_READ_ANY,
    );

    const sessions = await this.sessionManagementRepository.listActiveByUserId(
      targetUserId,
      this.clock.now(),
    );

    return sessions.map((session) => ({
      ...session,
      isCurrent: session.sessionId === query.identity.sessionId,
    }));
  }
}

export function assertCanManageTargetUser(
  identity: AuthenticatedIdentity,
  targetUserId: string,
  requiredPermission: PermissionCode,
): void {
  if (targetUserId === identity.userId) {
    return;
  }

  if (!identity.permissionCodes.includes(requiredPermission)) {
    throw new AppError(APP_ERROR_CODE.AUTH_PERMISSION_DENIED);
  }
}
