import {
  resolveHttpLogLevel,
  type HttpLogPolicyInput,
} from "./http-log.policy";

function createInput(
  overrides: Partial<HttpLogPolicyInput> = {},
): HttpLogPolicyInput {
  return {
    statusCode: 200,
    isUnknownRoute: false,
    isHealthRoute: false,
    logHealthRequests: false,
    ...overrides,
  };
}

describe("resolveHttpLogLevel", () => {
  it("uses info for successful requests", () => {
    expect(resolveHttpLogLevel(createInput())).toBe("info");
  });

  it("suppresses successful health requests by default", () => {
    expect(resolveHttpLogLevel(createInput({ isHealthRoute: true }))).toBe(
      "silent",
    );
  });

  it("logs successful health requests when enabled", () => {
    expect(
      resolveHttpLogLevel(
        createInput({
          isHealthRoute: true,
          logHealthRequests: true,
        }),
      ),
    ).toBe("info");
  });

  it("logs failed health requests as errors", () => {
    expect(
      resolveHttpLogLevel(
        createInput({
          statusCode: 503,
          isHealthRoute: true,
        }),
      ),
    ).toBe("error");
  });

  it("uses info for unknown-route 404 responses", () => {
    expect(
      resolveHttpLogLevel(
        createInput({
          statusCode: 404,
          isUnknownRoute: true,
        }),
      ),
    ).toBe("info");
  });

  it("uses warn for matched-route 404 responses", () => {
    expect(resolveHttpLogLevel(createInput({ statusCode: 404 }))).toBe("warn");
  });

  it.each([400, 401, 403, 409, 422, 429])(
    "uses warn for status %i",
    (statusCode) => {
      expect(resolveHttpLogLevel(createInput({ statusCode }))).toBe("warn");
    },
  );

  it("uses error for 5xx responses", () => {
    expect(resolveHttpLogLevel(createInput({ statusCode: 500 }))).toBe("error");
  });
});
