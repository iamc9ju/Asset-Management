import type { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuthRetentionIndexes1790283600000
  implements MigrationInterface
{
  public readonly name = "AddAuthRetentionIndexes1790283600000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX ix_auth_sessions_revoked_at
        ON auth_sessions (revoked_at)
        WHERE revoked_at IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX ix_auth_sessions_revoked_at;
    `);
  }
}
