import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  CREATE_LOGIN_SESSION_RESULT,
  type AuthSessionRepository,
  type CreateLoginSessionInput,
  type CreateLoginSessionResult,
} from "../../application/ports/auth-session-repository.port";
import { AuthRefreshTokenOrmEntity } from "./entities/auth-refresh-token.orm-entity";
import { AuthSessionOrmEntity } from "./entities/auth-session.orm-entity";
import { insertLoginSuccessActivity } from "./auth-activity-log.persistence";

interface UpdatedActiveUserRow {
  readonly id: string;
}

@Injectable()
export class TypeOrmAuthSessionRepository implements AuthSessionRepository {
  constructor(private readonly dataSource: DataSource) {}

  createLoginSession(
    input: CreateLoginSessionInput,
  ): Promise<CreateLoginSessionResult> {
    return this.dataSource.transaction(async (manager) => {
      const [updatedUsers] = (await manager.query(
        `
          UPDATE users
          SET
            last_login_at = $1,
            updated_at = $1,
            version = version + 1
          WHERE id = $2
            AND status = 'ACTIVE'
          RETURNING id
        `,
        [input.occurredAt, input.userId],
      )) as [UpdatedActiveUserRow[], number];

      if (updatedUsers.length !== 1) {
        return CREATE_LOGIN_SESSION_RESULT.USER_NOT_ACTIVE;
      }

      await manager.insert(AuthSessionOrmEntity, {
        id: input.sessionId,
        userId: input.userId,
        deviceLabel: input.deviceLabel,
        ipCreated: input.client.ipAddress,
        userAgentCreated: input.client.userAgent,
        idleExpiresAt: input.idleExpiresAt,
        expiresAt: input.absoluteExpiresAt,
        lastUsedAt: input.occurredAt,
        revokedAt: null,
        revokeReason: null,
        createdAt: input.occurredAt,
      });

      await manager.insert(AuthRefreshTokenOrmEntity, {
        id: input.refreshTokenId,
        sessionId: input.sessionId,
        parentTokenId: null,
        tokenHash: input.refreshTokenHash,
        issuedAt: input.occurredAt,
        expiresAt: input.absoluteExpiresAt,
        usedAt: null,
        revokedAt: null,
        replacedByTokenId: null,
        ipUsed: null,
      });

      await insertLoginSuccessActivity(manager, {
        userId: input.userId,
        sessionId: input.sessionId,
        occurredAt: input.occurredAt,
        client: input.client,
      });

      return CREATE_LOGIN_SESSION_RESULT.CREATED;
    });
  }
}
