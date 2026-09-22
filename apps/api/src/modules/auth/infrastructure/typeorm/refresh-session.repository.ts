import { Inject, Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import { USER_STATUS } from "../../../iam/domain/user-status";
import {
  ROTATE_REFRESH_SESSION_RESULT,
  type RefreshSessionRepository,
  type RotateRefreshSessionInput,
  type RotateRefreshSessionResult,
} from "../../application/ports/refresh-session-repository.port";
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from "../../application/ports/refresh-token.port";
import { AUTH_SESSION_REVOKE_REASON } from "../../domain/auth.constants";
import { calculateRefreshedIdleExpiration } from "../../domain/session-policy";
import {
  insertRefreshTokenReuseActivity,
  insertTokenRefreshedActivity,
} from "./auth-activity-log.persistence";
import { AuthRefreshTokenOrmEntity } from "./entities/auth-refresh-token.orm-entity";

interface LockedRefreshTokenRow {
  readonly id: string;
  readonly session_id: string;
  readonly token_hash: string;
  readonly expires_at: Date;
  readonly used_at: Date | null;
  readonly revoked_at: Date | null;
  readonly replaced_by_token_id: string | null;
}

interface LockedSessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly idle_expires_at: Date;
  readonly expires_at: Date;
  readonly last_used_at: Date | null;
  readonly revoked_at: Date | null;
  readonly user_status: string;
}

@Injectable()
export class TypeOrmRefreshSessionRepository implements RefreshSessionRepository {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  rotate(
    input: RotateRefreshSessionInput,
  ): Promise<RotateRefreshSessionResult> {
    return this.dataSource.transaction(async (manager) => {
      const tokenRows = (await manager.query(
        `
          SELECT
            id,
            session_id,
            token_hash,
            expires_at,
            used_at,
            revoked_at,
            replaced_by_token_id
          FROM auth_refresh_tokens
          WHERE id = $1
          FOR UPDATE
        `,
        [input.currentTokenId],
      )) as LockedRefreshTokenRow[];
      const token = tokenRows[0];

      if (!token) {
        return { status: ROTATE_REFRESH_SESSION_RESULT.INVALID };
      }

      const sessionRows = (await manager.query(
        `
          SELECT
            session.id,
            session.user_id,
            session.idle_expires_at,
            session.expires_at,
            session.last_used_at,
            session.revoked_at,
            app_user.status AS user_status
          FROM auth_sessions AS session
          INNER JOIN users AS app_user ON app_user.id = session.user_id
          WHERE session.id = $1
          FOR UPDATE OF session, app_user
        `,
        [token.session_id],
      )) as LockedSessionRow[];
      const session = sessionRows[0];

      if (
        !session ||
        !this.refreshTokenService.hashesMatch(
          token.token_hash,
          input.currentTokenHash,
        )
      ) {
        return { status: ROTATE_REFRESH_SESSION_RESULT.INVALID };
      }

      if (token.used_at || token.replaced_by_token_id || token.revoked_at) {
        await this.revokeSessionForReuse(manager, session, input);
        return { status: ROTATE_REFRESH_SESSION_RESULT.REUSED };
      }

      if (session.user_status !== USER_STATUS.ACTIVE || session.revoked_at) {
        return { status: ROTATE_REFRESH_SESSION_RESULT.INVALID };
      }

      if (
        input.occurredAt >= token.expires_at ||
        input.occurredAt >= session.idle_expires_at ||
        input.occurredAt >= session.expires_at
      ) {
        return { status: ROTATE_REFRESH_SESSION_RESULT.EXPIRED };
      }

      const idleExpiresAt = calculateRefreshedIdleExpiration(
        input.occurredAt,
        session.expires_at,
        input.idleTtlSeconds,
      );

      await manager.insert(AuthRefreshTokenOrmEntity, {
        id: input.replacementTokenId,
        sessionId: session.id,
        parentTokenId: token.id,
        tokenHash: input.replacementTokenHash,
        issuedAt: input.occurredAt,
        expiresAt: session.expires_at,
        usedAt: null,
        revokedAt: null,
        replacedByTokenId: null,
        ipUsed: null,
      });

      await manager.query(
        `
          UPDATE auth_refresh_tokens
          SET
            used_at = $1,
            replaced_by_token_id = $2,
            ip_used = $3
          WHERE id = $4
        `,
        [
          input.occurredAt,
          input.replacementTokenId,
          input.client.ipAddress,
          token.id,
        ],
      );
      await manager.query(
        `
          UPDATE auth_sessions
          SET
            last_used_at = $1,
            idle_expires_at = $2
          WHERE id = $3
        `,
        [input.occurredAt, idleExpiresAt, session.id],
      );
      await insertTokenRefreshedActivity(manager, {
        userId: session.user_id,
        sessionId: session.id,
        occurredAt: input.occurredAt,
        client: input.client,
      });

      return {
        status: ROTATE_REFRESH_SESSION_RESULT.ROTATED,
        userId: session.user_id,
        sessionId: session.id,
        refreshTokenExpiresAt: session.expires_at,
      };
    });
  }

  private async revokeSessionForReuse(
    manager: EntityManager,
    session: LockedSessionRow,
    input: RotateRefreshSessionInput,
  ): Promise<void> {
    const reuseOccurredAt = latestDate(
      input.occurredAt,
      session.last_used_at,
      session.revoked_at,
    );

    await manager.query(
      `
        UPDATE auth_sessions
        SET
          revoked_at = COALESCE(revoked_at, $1),
          revoke_reason = COALESCE(revoke_reason, $2)
        WHERE id = $3
      `,
      [
        reuseOccurredAt,
        AUTH_SESSION_REVOKE_REASON.REFRESH_TOKEN_REUSE,
        session.id,
      ],
    );
    await manager.query(
      `
        UPDATE auth_refresh_tokens
        SET revoked_at = COALESCE(revoked_at, $1)
        WHERE session_id = $2
      `,
      [reuseOccurredAt, session.id],
    );
    await insertRefreshTokenReuseActivity(manager, {
      userId: session.user_id,
      sessionId: session.id,
      occurredAt: reuseOccurredAt,
      client: input.client,
    });
  }
}

function latestDate(
  required: Date,
  ...optionalDates: ReadonlyArray<Date | null>
): Date {
  return new Date(
    Math.max(
      required.getTime(),
      ...optionalDates.map(
        (date) => date?.getTime() ?? Number.NEGATIVE_INFINITY,
      ),
    ),
  );
}
