import { Inject, Injectable } from "@nestjs/common";
import { DataSource, type EntityManager } from "typeorm";
import type {
  LogoutByRefreshCredentialInput,
  ManagedAuthSession,
  RevokeAllManagedSessionsInput,
  RevokeManagedSessionInput,
  SessionManagementRepository,
} from "../../application/ports/session-management-repository.port";
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from "../../application/ports/refresh-token.port";
import { AUTH_SESSION_REVOKE_REASON } from "../../domain/auth.constants";
import {
  insertLogoutSuccessActivity,
  insertSessionRevokedActivity,
} from "./auth-activity-log.persistence";

interface SessionRow {
  readonly id: string;
  readonly user_id: string;
  readonly device_label: string | null;
  readonly created_at: Date;
  readonly last_used_at: Date | null;
  readonly idle_expires_at: Date;
  readonly expires_at: Date;
  readonly revoked_at: Date | null;
}

interface RefreshCredentialRow {
  readonly session_id: string;
  readonly token_hash: string;
}

interface RevokedSessionRow {
  readonly id: string;
  readonly revoked_at: Date;
}

@Injectable()
export class TypeOrmSessionManagementRepository implements SessionManagementRepository {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async listActiveByUserId(
    userId: string,
    activeAt: Date,
  ): Promise<readonly ManagedAuthSession[]> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          id,
          user_id,
          device_label,
          created_at,
          last_used_at,
          idle_expires_at,
          expires_at,
          revoked_at
        FROM auth_sessions
        WHERE user_id = $1
          AND revoked_at IS NULL
          AND idle_expires_at > $2
          AND expires_at > $2
        ORDER BY created_at DESC, id DESC
      `,
      [userId, activeAt],
    )) as SessionRow[];

    return rows.map(mapSessionRow);
  }

  async findById(sessionId: string): Promise<ManagedAuthSession | null> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          id,
          user_id,
          device_label,
          created_at,
          last_used_at,
          idle_expires_at,
          expires_at,
          revoked_at
        FROM auth_sessions
        WHERE id = $1
      `,
      [sessionId],
    )) as SessionRow[];
    const row = rows[0];

    return row ? mapSessionRow(row) : null;
  }

  logoutByRefreshCredential(
    input: LogoutByRefreshCredentialInput,
  ): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const tokenRows = (await manager.query(
        `
          SELECT session_id, token_hash
          FROM auth_refresh_tokens
          WHERE id = $1
          FOR UPDATE
        `,
        [input.tokenId],
      )) as RefreshCredentialRow[];
      const token = tokenRows[0];

      if (
        !token ||
        !this.refreshTokenService.hashesMatch(token.token_hash, input.tokenHash)
      ) {
        return;
      }

      const sessionRows = (await manager.query(
        `
          SELECT
            id,
            user_id,
            device_label,
            created_at,
            last_used_at,
            idle_expires_at,
            expires_at,
            revoked_at
          FROM auth_sessions
          WHERE id = $1
          FOR UPDATE
        `,
        [token.session_id],
      )) as SessionRow[];
      const session = sessionRows[0];

      if (!session || session.revoked_at) {
        return;
      }

      const revokedAt = latestDate(
        input.occurredAt,
        session.created_at,
        session.last_used_at,
      );

      await revokeSessionFamily(
        manager,
        session.id,
        revokedAt,
        AUTH_SESSION_REVOKE_REASON.USER_LOGOUT,
      );
      await insertLogoutSuccessActivity(manager, {
        userId: session.user_id,
        sessionId: session.id,
        occurredAt: revokedAt,
        client: input.client,
      });
    });
  }

  revokeById(input: RevokeManagedSessionInput): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const sessionRows = (await manager.query(
        `
          SELECT
            id,
            user_id,
            device_label,
            created_at,
            last_used_at,
            idle_expires_at,
            expires_at,
            revoked_at
          FROM auth_sessions
          WHERE id = $1
          FOR UPDATE
        `,
        [input.sessionId],
      )) as SessionRow[];
      const session = sessionRows[0];

      if (!session) {
        return false;
      }

      if (session.revoked_at) {
        return true;
      }

      const revokedAt = latestDate(
        input.occurredAt,
        session.created_at,
        session.last_used_at,
      );

      await revokeSessionFamily(manager, session.id, revokedAt, input.reason);
      await insertSessionRevokedActivity(manager, {
        actorUserId: input.actorUserId,
        sessionId: session.id,
        reason: input.reason,
        occurredAt: revokedAt,
        client: input.client,
      });

      return true;
    });
  }

  revokeAllByUserId(input: RevokeAllManagedSessionsInput): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const [revokedSessions] = (await manager.query(
        `
          UPDATE auth_sessions
          SET
            revoked_at = GREATEST($1, created_at, COALESCE(last_used_at, $1)),
            revoke_reason = $2
          WHERE user_id = $3
            AND revoked_at IS NULL
          RETURNING id, revoked_at
        `,
        [input.occurredAt, input.reason, input.userId],
      )) as [RevokedSessionRow[], number];

      if (revokedSessions.length === 0) {
        return 0;
      }

      const sessionIds = revokedSessions.map((session) => session.id);

      await manager.query(
        `
          UPDATE auth_refresh_tokens
          SET revoked_at = COALESCE(
            revoked_at,
            GREATEST($1, issued_at)
          )
          WHERE session_id = ANY($2::uuid[])
        `,
        [input.occurredAt, sessionIds],
      );

      for (const session of revokedSessions) {
        await insertSessionRevokedActivity(manager, {
          actorUserId: input.actorUserId,
          sessionId: session.id,
          reason: input.reason,
          occurredAt: session.revoked_at,
          client: input.client,
        });
      }

      return revokedSessions.length;
    });
  }
}

async function revokeSessionFamily(
  manager: EntityManager,
  sessionId: string,
  revokedAt: Date,
  reason: string,
): Promise<void> {
  await manager.query(
    `
      UPDATE auth_sessions
      SET revoked_at = $1, revoke_reason = $2
      WHERE id = $3
        AND revoked_at IS NULL
    `,
    [revokedAt, reason, sessionId],
  );
  await manager.query(
    `
      UPDATE auth_refresh_tokens
      SET revoked_at = COALESCE(
        revoked_at,
        GREATEST($1, issued_at)
      )
      WHERE session_id = $2
    `,
    [revokedAt, sessionId],
  );
}

function mapSessionRow(row: SessionRow): ManagedAuthSession {
  return {
    sessionId: row.id,
    userId: row.user_id,
    deviceLabel: row.device_label,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    idleExpiresAt: row.idle_expires_at,
    absoluteExpiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

function latestDate(
  required: Date,
  ...dates: ReadonlyArray<Date | null>
): Date {
  return new Date(
    Math.max(
      required.getTime(),
      ...dates.map((date) => date?.getTime() ?? Number.NEGATIVE_INFINITY),
    ),
  );
}
