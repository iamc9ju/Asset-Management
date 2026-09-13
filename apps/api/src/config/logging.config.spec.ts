import {
  APPLICATION_SERVICE_NAME,
  createLoggingConfiguration,
  type ApplicationEnvironment,
  type LogLevel,
} from "./logging.config";

const DEFAULT_CASES = [
  ["development", "debug", true],
  ["test", "silent", false],
  ["production", "info", false],
] as const satisfies ReadonlyArray<
  readonly [ApplicationEnvironment, LogLevel, boolean]
>;

describe("createLoggingConfiguration", () => {
  it.each(DEFAULT_CASES)(
    "uses the approved defaults for %s",
    (nodeEnvironment, expectedLevel, expectedPretty) => {
      expect(
        createLoggingConfiguration({
          NODE_ENV: nodeEnvironment,
        }),
      ).toEqual({
        serviceName: APPLICATION_SERVICE_NAME,
        environment: nodeEnvironment,
        level: expectedLevel,
        pretty: expectedPretty,
        logHealthRequests: false,
      });
    },
  );

  it("applies explicit non-production overrides", () => {
    expect(
      createLoggingConfiguration({
        NODE_ENV: "test",
        LOG_LEVEL: "error",
        LOG_PRETTY: true,
        LOG_HEALTH_REQUESTS: true,
      }),
    ).toEqual({
      serviceName: APPLICATION_SERVICE_NAME,
      environment: "test",
      level: "error",
      pretty: true,
      logHealthRequests: true,
    });
  });

  it("defensively disables pretty logs in production", () => {
    const result = createLoggingConfiguration({
      NODE_ENV: "production",
      LOG_PRETTY: true,
    });

    expect(result.pretty).toBe(false);
  });
});
