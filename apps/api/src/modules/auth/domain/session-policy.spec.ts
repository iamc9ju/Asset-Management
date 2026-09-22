import {
  calculateInitialSessionExpiration,
  calculateRefreshedIdleExpiration,
} from "./session-policy";

describe("calculateInitialSessionExpiration", () => {
  const now = new Date("2026-09-17T00:00:00.000Z");

  it("calculates the idle and absolute expiry from the same instant", () => {
    expect(
      calculateInitialSessionExpiration(now, {
        idleTtlSeconds: 60,
        absoluteTtlSeconds: 300,
      }),
    ).toEqual({
      idleExpiresAt: new Date("2026-09-17T00:01:00.000Z"),
      absoluteExpiresAt: new Date("2026-09-17T00:05:00.000Z"),
    });
  });

  it("never lets the idle expiry exceed the absolute expiry", () => {
    expect(
      calculateInitialSessionExpiration(now, {
        idleTtlSeconds: 600,
        absoluteTtlSeconds: 300,
      }).idleExpiresAt,
    ).toEqual(new Date("2026-09-17T00:05:00.000Z"));
  });
});

describe("calculateRefreshedIdleExpiration", () => {
  const now = new Date("2026-09-17T00:00:00.000Z");

  it("extends the idle expiry from the rotation instant", () => {
    expect(
      calculateRefreshedIdleExpiration(
        now,
        new Date("2026-09-17T01:00:00.000Z"),
        600,
      ),
    ).toEqual(new Date("2026-09-17T00:10:00.000Z"));
  });

  it("caps the refreshed idle expiry at the absolute expiry", () => {
    expect(
      calculateRefreshedIdleExpiration(
        now,
        new Date("2026-09-17T00:05:00.000Z"),
        600,
      ),
    ).toEqual(new Date("2026-09-17T00:05:00.000Z"));
  });
});
