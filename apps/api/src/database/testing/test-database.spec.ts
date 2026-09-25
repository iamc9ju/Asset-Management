import type { DataSource } from "typeorm";
import {
  assertDirectTestDatabaseUrl,
  initializeTestDataSource,
  isTransientTestDatabaseError,
  waitForTestDatabase,
} from "./test-database";

interface DataSourceMock {
  readonly dataSource: DataSource;
  readonly initialize: jest.Mock;
  readonly query: jest.Mock;
  readonly destroy: jest.Mock;
}

function createDataSourceMock(): DataSourceMock {
  let initialized = false;
  const initialize = jest.fn(async () => {
    initialized = true;
  });
  const query = jest.fn().mockResolvedValue([{ ready: 1 }]);
  const destroy = jest.fn(async () => {
    initialized = false;
  });
  const dataSource = {
    initialize,
    query,
    destroy,
    get isInitialized() {
      return initialized;
    },
  } as unknown as DataSource;

  return {
    dataSource,
    initialize,
    query,
    destroy,
  };
}

describe("test database lifecycle", () => {
  it("recreates and initializes a data source after a transient startup failure", async () => {
    const first = createDataSourceMock();
    const second = createDataSourceMock();
    const timeout = Object.assign(
      new Error("Connection terminated due to connection timeout"),
      { code: "ETIMEDOUT" },
    );
    first.initialize.mockRejectedValue(timeout);
    const createDataSource = jest
      .fn<DataSource, []>()
      .mockReturnValueOnce(first.dataSource)
      .mockReturnValueOnce(second.dataSource);

    await expect(
      initializeTestDataSource(createDataSource, {
        maxAttempts: 2,
        initialDelayMs: 0,
      }),
    ).resolves.toBe(second.dataSource);

    expect(createDataSource).toHaveBeenCalledTimes(2);
    expect(first.query).not.toHaveBeenCalled();
    expect(second.query).toHaveBeenCalledWith("SELECT 1");
  });

  it("destroys an initialized but unhealthy data source before retrying", async () => {
    const first = createDataSourceMock();
    const second = createDataSourceMock();
    first.query.mockRejectedValueOnce(
      new Error("Connection terminated unexpectedly"),
    );
    const createDataSource = jest
      .fn<DataSource, []>()
      .mockReturnValueOnce(first.dataSource)
      .mockReturnValueOnce(second.dataSource);

    await initializeTestDataSource(createDataSource, {
      maxAttempts: 2,
      initialDelayMs: 0,
    });

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(second.destroy).not.toHaveBeenCalled();
  });

  it("does not retry a non-transient initialization failure", async () => {
    const database = createDataSourceMock();
    const authenticationError = Object.assign(
      new Error("password authentication failed"),
      { code: "28P01" },
    );
    database.initialize.mockRejectedValue(authenticationError);
    const createDataSource = jest.fn(() => database.dataSource);

    await expect(
      initializeTestDataSource(createDataSource, {
        maxAttempts: 3,
        initialDelayMs: 0,
      }),
    ).rejects.toBe(authenticationError);

    expect(createDataSource).toHaveBeenCalledTimes(1);
  });

  it("retries a health check on an existing data source", async () => {
    const database = createDataSourceMock();
    database.query
      .mockRejectedValueOnce(new Error("read ECONNRESET"))
      .mockResolvedValueOnce([{ ready: 1 }]);

    await expect(
      waitForTestDatabase(database.dataSource, {
        maxAttempts: 2,
        initialDelayMs: 0,
      }),
    ).resolves.toBeUndefined();

    expect(database.query).toHaveBeenCalledTimes(2);
  });

  it("recognizes a transient error nested in the cause chain", () => {
    const nestedError = new Error("Database initialization failed", {
      cause: Object.assign(new Error("connect ETIMEDOUT"), {
        code: "ETIMEDOUT",
      }),
    });

    expect(isTransientTestDatabaseError(nestedError)).toBe(true);
  });

  it("rejects a pooled database endpoint", () => {
    expect(() =>
      assertDirectTestDatabaseUrl(
        "postgresql://user:password@example-pooler.neon.tech/database",
      ),
    ).toThrow("without the -pooler suffix");
  });

  it("rejects a missing direct test database endpoint", () => {
    expect(() => assertDirectTestDatabaseUrl(undefined)).toThrow(
      "DATABASE_URL_UNPOOLED must target a direct test database endpoint",
    );
  });
});
