import { sanitizeErrorDetails } from "./error-details";

describe("sanitizeErrorDetails", () => {
  it("preserves JSON-safe details", () => {
    expect(
      sanitizeErrorDetails({
        asset_id: "asset-123",
        version: 2,
        active: true,
      }),
    ).toEqual({
      asset_id: "asset-123",
      version: 2,
      active: true,
    });
  });

  it("removes sensitive fields recursively", () => {
    expect(
      sanitizeErrorDetails({
        asset_id: "asset-123",
        password: "do-not-expose",
        nested: {
          access_token: "do-not-expose",
          accessToken: "do-not-expose",
          apiKey: "do-not-expose",
          sql: "select secret from users",
          query: "select secret from users",
          stack: "sensitive stack trace",
          reason: "safe",
        },
      }),
    ).toEqual({
      asset_id: "asset-123",
      nested: {
        reason: "safe",
      },
    });
  });

  it("does not recurse indefinitely for circular input", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(sanitizeErrorDetails(circular)).toEqual({
      self: "[TRUNCATED]",
    });
  });
});
