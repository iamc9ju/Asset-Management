const TEST_DATABASE_URL =
  "postgresql://database-user:database-password@example.com/database";
const EXPECTED_MIGRATION_GLOB = "src/database/migrations/[0-9]*-*.ts";

describe("TypeORM CLI configuration", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalUnpooledDatabaseUrl = process.env.DATABASE_URL_UNPOOLED;

  beforeEach(() => {
    jest.resetModules();
    process.env.DATABASE_URL_UNPOOLED = TEST_DATABASE_URL;
  });

  afterEach(() => {
    restoreEnvironmentVariable("DATABASE_URL", originalDatabaseUrl);
    restoreEnvironmentVariable(
      "DATABASE_URL_UNPOOLED",
      originalUnpooledDatabaseUrl,
    );
    jest.resetModules();
  });

  it("discovers timestamped migrations without loading colocated test files", async () => {
    const { TYPEORM_CLI_MIGRATION_GLOB, default: dataSource } =
      await import("./typeorm-cli.config");

    expect(TYPEORM_CLI_MIGRATION_GLOB).toBe(EXPECTED_MIGRATION_GLOB);
    expect(dataSource.options.migrations).toEqual([EXPECTED_MIGRATION_GLOB]);
    expect(TYPEORM_CLI_MIGRATION_GLOB).not.toBe("src/database/migrations/*.ts");
  });
});

function restoreEnvironmentVariable(
  name: "DATABASE_URL" | "DATABASE_URL_UNPOOLED",
  value: string | undefined,
): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
