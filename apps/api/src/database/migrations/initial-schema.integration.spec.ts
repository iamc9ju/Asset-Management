import "dotenv/config";
import { randomUUID } from "node:crypto";
import { DataSource, type QueryRunner } from "typeorm";
import {
  assertDirectTestDatabaseUrl,
  initializeTestDataSource,
  isTransientTestDatabaseError,
  TEST_DATABASE_SUITE_TIMEOUT_MS,
  waitForTestDatabase,
} from "../testing/test-database";
import { CreateInitialSchema1789236000000 } from "./1789236000000-CreateInitialSchema";
import { AddAuthRetentionIndexes1790283600000 } from "./1790283600000-AddAuthRetentionIndexes";

const DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
assertDirectTestDatabaseUrl(DATABASE_URL);
const EXPECTED_TABLE_COUNT = 24;

jest.setTimeout(TEST_DATABASE_SUITE_TIMEOUT_MS);

interface AssetFixture {
  assetId: string;
  categoryId: string;
  locationId: string;
  userId: string;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

describe("CreateInitialSchema migration integration", () => {
  const schemaName = `test_initial_schema_${randomUUID().replaceAll("-", "_")}`;
  const quotedSchemaName = quoteIdentifier(schemaName);
  const migration = new CreateInitialSchema1789236000000();
  const retentionMigration = new AddAuthRetentionIndexes1790283600000();

  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let schemaCreated = false;
  let migrationApplied = false;
  let retentionMigrationApplied = false;

  beforeAll(async () => {
    dataSource = await initializeTestDataSource(
      () =>
        new DataSource({
          type: "postgres",
          url: DATABASE_URL,
          poolSize: 1,
          extra: {
            enableChannelBinding: true,
            keepAlive: true,
          },
          connectTimeoutMS: 15_000,
          synchronize: false,
          logging: false,
        }),
    );
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    await queryRunner.query(
      "CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public",
    );
    await queryRunner.query(
      "CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public",
    );
    await queryRunner.query(`CREATE SCHEMA ${quotedSchemaName}`);
    schemaCreated = true;
    await queryRunner.query(`SET search_path TO ${quotedSchemaName}, public`);

    await migration.up(queryRunner);
    migrationApplied = true;
    await retentionMigration.up(queryRunner);
    retentionMigrationApplied = true;
  });

  beforeEach(async () => {
    await queryRunner.startTransaction();
  });

  afterEach(async () => {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
  });

  afterAll(async () => {
    if (!queryRunner) {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
      return;
    }

    try {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }

      if (retentionMigrationApplied) {
        await retentionMigration.down(queryRunner);
        retentionMigrationApplied = false;
      }

      if (migrationApplied) {
        await migration.down(queryRunner);
        migrationApplied = false;

        const result = (await queryRunner.query(
          `
            SELECT count(*)::integer AS table_count
            FROM information_schema.tables
            WHERE table_schema = $1
          `,
          [schemaName],
        )) as Array<{ table_count: number }>;

        expect(result[0]?.table_count).toBe(0);
      }
    } finally {
      if (schemaCreated && dataSource.isInitialized) {
        try {
          await queryRunner.query("SET search_path TO public");
          await queryRunner.query(
            `DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`,
          );
        } catch (error) {
          if (!isTransientTestDatabaseError(error)) {
            throw error;
          }

          if (!queryRunner.isReleased) {
            await queryRunner.release();
          }

          await waitForTestDatabase(dataSource);
          await dataSource.query(
            `DROP SCHEMA IF EXISTS ${quotedSchemaName} CASCADE`,
          );
        }

        schemaCreated = false;
      }

      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }

      if (dataSource.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  async function insertUser(
    email = `${randomUUID()}@example.com`,
  ): Promise<string> {
    const userId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO users (
          id,
          email,
          password_hash,
          display_name
        )
        VALUES ($1, $2, $3, $4)
      `,
      [userId, email, "$argon2id$test-hash", "Integration Test User"],
    );

    return userId;
  }

  async function insertAssetFixture(): Promise<AssetFixture> {
    const userId = await insertUser();
    const categoryId = randomUUID();
    const locationId = randomUUID();
    const assetId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO asset_categories (id, code, name)
        VALUES ($1, $2, $3)
      `,
      [categoryId, `CAT-${randomUUID()}`, "Integration Category"],
    );

    await queryRunner.query(
      `
        INSERT INTO locations (id, code, name)
        VALUES ($1, $2, $3)
      `,
      [locationId, `LOC-${randomUUID()}`, "Integration Location"],
    );

    await queryRunner.query(
      `
        INSERT INTO assets (
          id,
          asset_code,
          name,
          category_id,
          current_location_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $6)
      `,
      [
        assetId,
        `ASSET-${randomUUID()}`,
        "Integration Asset",
        categoryId,
        locationId,
        userId,
      ],
    );

    return { assetId, categoryId, locationId, userId };
  }

  async function insertCampaign(userId: string): Promise<string> {
    const campaignId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO audit_campaigns (
          id,
          code,
          name,
          starts_at,
          ends_at,
          created_by
        )
        VALUES (
          $1,
          $2,
          $3,
          '2026-01-01T00:00:00Z',
          '2026-12-31T23:59:59Z',
          $4
        )
      `,
      [campaignId, `CAMPAIGN-${randomUUID()}`, "Integration Campaign", userId],
    );

    return campaignId;
  }

  async function insertCampaignAsset(
    campaignId: string,
    fixture: AssetFixture,
  ): Promise<string> {
    const campaignAssetId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO audit_campaign_assets (
          id,
          campaign_id,
          asset_id,
          asset_code_snapshot,
          asset_name_snapshot,
          category_id_snapshot,
          category_name_snapshot,
          expected_location_id,
          expected_location_name,
          lifecycle_status_snapshot,
          condition_status_snapshot
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        campaignAssetId,
        campaignId,
        fixture.assetId,
        `SNAPSHOT-${randomUUID()}`,
        "Snapshot Asset",
        fixture.categoryId,
        "Snapshot Category",
        fixture.locationId,
        "Snapshot Location",
        "DRAFT",
        "UNKNOWN",
      ],
    );

    return campaignAssetId;
  }

  async function insertScanEvent(input: {
    campaignId: string;
    campaignAssetId: string;
    fixture: AssetFixture;
    deviceId: string;
    clientEventId: string;
  }): Promise<void> {
    await queryRunner.query(
      `
        INSERT INTO audit_scan_events (
          id,
          campaign_id,
          campaign_asset_id,
          asset_id,
          scanned_value,
          device_id,
          client_event_id,
          auditor_user_id,
          scanned_at,
          outcome,
          request_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          now(),
          'ACCEPTED',
          $9
        )
      `,
      [
        randomUUID(),
        input.campaignId,
        input.campaignAssetId,
        input.fixture.assetId,
        `SCAN-${randomUUID()}`,
        input.deviceId,
        input.clientEventId,
        input.fixture.userId,
        randomUUID(),
      ],
    );
  }

  it("creates every MVP application table inside the isolated schema", async () => {
    const result = (await queryRunner.query(
      `
        SELECT count(*)::integer AS table_count
        FROM information_schema.tables
        WHERE table_schema = $1
      `,
      [schemaName],
    )) as Array<{ table_count: number }>;

    expect(result[0]?.table_count).toBe(EXPECTED_TABLE_COUNT);
  });

  it("creates the partial revoked-session retention index", async () => {
    const rows = (await queryRunner.query(
      `
        SELECT indexdef
        FROM pg_indexes
        WHERE schemaname = $1
          AND indexname = 'ix_auth_sessions_revoked_at'
      `,
      [schemaName],
    )) as Array<{ indexdef: string }>;

    expect(rows[0]?.indexdef).toContain("WHERE (revoked_at IS NOT NULL)");
  });

  it("rejects case-insensitive duplicate user emails", async () => {
    await insertUser("Operator@example.com");

    await expect(insertUser("operator@EXAMPLE.com")).rejects.toMatchObject({
      code: "23505",
      constraint: "uq_users_email_ci",
    });
  });

  it("allows only one refresh-token successor for each parent", async () => {
    const userId = await insertUser();
    const sessionId = randomUUID();
    const parentTokenId = randomUUID();

    await queryRunner.query(
      `
        INSERT INTO auth_sessions (
          id,
          user_id,
          idle_expires_at,
          expires_at
        )
        VALUES ($1, $2, now() + interval '7 days', now() + interval '30 days')
      `,
      [sessionId, userId],
    );

    await queryRunner.query(
      `
        INSERT INTO auth_refresh_tokens (
          id,
          session_id,
          token_hash,
          expires_at
        )
        VALUES ($1, $2, $3, now() + interval '30 days')
      `,
      [parentTokenId, sessionId, "a".repeat(64)],
    );

    await queryRunner.query(
      `
        INSERT INTO auth_refresh_tokens (
          id,
          session_id,
          parent_token_id,
          token_hash,
          expires_at
        )
        VALUES ($1, $2, $3, $4, now() + interval '30 days')
      `,
      [randomUUID(), sessionId, parentTokenId, "b".repeat(64)],
    );

    await expect(
      queryRunner.query(
        `
          INSERT INTO auth_refresh_tokens (
            id,
            session_id,
            parent_token_id,
            token_hash,
            expires_at
          )
          VALUES ($1, $2, $3, $4, now() + interval '30 days')
        `,
        [randomUUID(), sessionId, parentTokenId, "c".repeat(64)],
      ),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "uq_auth_refresh_tokens_parent",
    });
  });

  it("rejects overlapping assignment intervals for one asset", async () => {
    const fixture = await insertAssetFixture();

    await queryRunner.query(
      `
        INSERT INTO asset_assignments (
          id,
          asset_id,
          assignee_user_id,
          started_at,
          ended_at,
          assigned_by,
          end_reason
        )
        VALUES (
          $1,
          $2,
          $3,
          '2026-01-01T00:00:00Z',
          '2026-02-01T00:00:00Z',
          $3,
          'TEST_INTERVAL_END'
        )
      `,
      [randomUUID(), fixture.assetId, fixture.userId],
    );

    await expect(
      queryRunner.query(
        `
          INSERT INTO asset_assignments (
            id,
            asset_id,
            assignee_user_id,
            started_at,
            ended_at,
            assigned_by,
            end_reason
          )
          VALUES (
            $1,
            $2,
            $3,
            '2026-01-15T00:00:00Z',
            '2026-03-01T00:00:00Z',
            $3,
            'TEST_INTERVAL_END'
          )
        `,
        [randomUUID(), fixture.assetId, fixture.userId],
      ),
    ).rejects.toMatchObject({
      code: "23P01",
      constraint: "ex_asset_assignments_no_overlap",
    });
  });

  it("rejects duplicate scan client-event identity", async () => {
    const fixture = await insertAssetFixture();
    const campaignId = await insertCampaign(fixture.userId);
    const campaignAssetId = await insertCampaignAsset(campaignId, fixture);
    const deviceId = randomUUID();
    const clientEventId = randomUUID();

    await insertScanEvent({
      campaignId,
      campaignAssetId,
      fixture,
      deviceId,
      clientEventId,
    });

    await expect(
      insertScanEvent({
        campaignId,
        campaignAssetId,
        fixture,
        deviceId,
        clientEventId,
      }),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "uq_audit_scan_events_client_event",
    });
  });

  it("rejects a campaign asset referenced from another campaign", async () => {
    const fixture = await insertAssetFixture();
    const sourceCampaignId = await insertCampaign(fixture.userId);
    const otherCampaignId = await insertCampaign(fixture.userId);
    const campaignAssetId = await insertCampaignAsset(
      sourceCampaignId,
      fixture,
    );

    await expect(
      insertScanEvent({
        campaignId: otherCampaignId,
        campaignAssetId,
        fixture,
        deviceId: randomUUID(),
        clientEventId: randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: "23503",
      constraint: "fk_audit_scan_events_campaign_asset",
    });
  });
});
