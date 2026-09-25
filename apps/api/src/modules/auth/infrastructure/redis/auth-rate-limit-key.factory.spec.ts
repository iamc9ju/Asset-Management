import type { AuthRateLimitConfig } from "../../application/config/auth-rate-limit.config";
import { AUTH_RATE_LIMIT_POLICY } from "../../domain/auth-rate-limit-policy";
import { AuthRateLimitKeyFactory } from "./auth-rate-limit-key.factory";

const CONFIG: AuthRateLimitConfig = {
  namespace: "asset-management-test",
  keySecret: "rate-limit-test-secret-with-at-least-256-bits-of-entropy",
  policies: {
    [AUTH_RATE_LIMIT_POLICY.LOGIN_IP]: { capacity: 100, windowSeconds: 900 },
    [AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT]: {
      capacity: 10,
      windowSeconds: 900,
    },
    [AUTH_RATE_LIMIT_POLICY.REFRESH_IP]: {
      capacity: 300,
      windowSeconds: 60,
    },
    [AUTH_RATE_LIMIT_POLICY.REFRESH_TOKEN]: {
      capacity: 30,
      windowSeconds: 60,
    },
  },
};

describe("AuthRateLimitKeyFactory", () => {
  const factory = new AuthRateLimitKeyFactory(CONFIG);

  it("creates deterministic namespaced keys without the raw subject", () => {
    const input = {
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
      subject: "user@example.com",
    } as const;
    const first = factory.create(input);
    const second = factory.create(input);

    expect(first).toBe(second);
    expect(first).toMatch(
      /^asset-management-test:auth-rate:v1:login_account:[0-9a-f]{64}$/,
    );
    expect(first).not.toContain(input.subject);
  });

  it("isolates different policies and subjects", () => {
    const accountKey = factory.create({
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
      subject: "user@example.com",
    });
    const ipKey = factory.create({
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_IP,
      subject: "192.0.2.10",
    });

    expect(accountKey).not.toBe(ipKey);
  });
});
