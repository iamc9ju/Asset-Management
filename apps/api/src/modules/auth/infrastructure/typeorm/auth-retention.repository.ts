import { Injectable } from "@nestjs/common";
import type { DataSource, QueryRunner } from "typeorm";
import type {
  AuthRetentionRepository,
  CleanupAuthRetentionInput,
  CleanupAuthRetentionResult,
} from "../../application/ports/auth-retention-repository.port";

const CLEANUP_LOCK_KEY = "asset-management:auth-retention-cleanup";

interface LockRow {
  readonly acquired: boolean;
}

interface CountRow {
  readonly count: number;
}

interface SessionIdRow {
  readonly id: string;
}

@Injectable()
export class TypeOrmAuthRetentionRepository
  implements AuthRetentionRepository
{
  constructor(private readonly dataSource: DataSource) {}

  async countEligible(cutoff: Date): Promise<number> {
    const rows = (await this.dataSource.query(
      `
        SELECT count(*)::integer AS count
        FROM auth_sessions
        WHERE
          (revoked_at IS NOT NULL AND revoked_at <= $1)
          OR (
            revoked_at IS NULL
            AND (idle_expires_at <= $1 OR expires_at <= $1)
          )
      `,
      [cutoff],
    )) as CountRow[];

    return rows[0]?.count ?? 0;
  }

  async cleanup(
    input: CleanupAuthRetentionInput,
  ): Promise<CleanupAuthRetentionResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    let lockAcquired = false;

    try {
      const lockRows = (await queryRunner.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
        [CLEANUP_LOCK_KEY],
      )) as LockRow[];
      lockAcquired = lockRows[0]?.acquired === true;

      if (!lockAcquired) {
        return {
          lockAcquired: false,
          deletedSessions: 0,
          completedBatches: 0,
          hasMore: false,
        };
      }

      let deletedSessions = 0;
      let completedBatches = 0;
      let lastBatchSize = 0;

      while (completedBatches < input.maxBatches) {
        lastBatchSize = await this.cleanupBatch(queryRunner, input);

        if (lastBatchSize === 0) {
          break;
        }

        deletedSessions += lastBatchSize;
        completedBatches += 1;

        if (lastBatchSize < input.batchSize) {
          break;
        }
      }

      return {
        lockAcquired: true,
        deletedSessions,
        completedBatches,
        hasMore:
          completedBatches === input.maxBatches &&
          lastBatchSize === input.batchSize,
      };
    } finally {
      if (lockAcquired) {
        await queryRunner.query(
          "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
          [CLEANUP_LOCK_KEY],
        );
      }

      await queryRunner.release();
    }
  }

  private async cleanupBatch(
    queryRunner: QueryRunner,
    input: CleanupAuthRetentionInput,
  ): Promise<number> {
    await queryRunner.startTransaction();

    try {
      const rows = (await queryRunner.query(
        `
          SELECT id
          FROM auth_sessions
          WHERE
            (revoked_at IS NOT NULL AND revoked_at <= $1)
            OR (
              revoked_at IS NULL
              AND (idle_expires_at <= $1 OR expires_at <= $1)
            )
          ORDER BY
            COALESCE(revoked_at, LEAST(idle_expires_at, expires_at)),
            id
          FOR UPDATE SKIP LOCKED
          LIMIT $2
        `,
        [input.cutoff, input.batchSize],
      )) as SessionIdRow[];

      const sessionIds = rows.map((row) => row.id);

      if (sessionIds.length === 0) {
        await queryRunner.commitTransaction();
        return 0;
      }

      await queryRunner.query(
        `
          UPDATE auth_refresh_tokens
          SET parent_token_id = NULL, replaced_by_token_id = NULL
          WHERE session_id = ANY($1::uuid[])
        `,
        [sessionIds],
      );
      await queryRunner.query(
        "DELETE FROM auth_sessions WHERE id = ANY($1::uuid[])",
        [sessionIds],
      );
      await queryRunner.commitTransaction();

      return sessionIds.length;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    }
  }
}
