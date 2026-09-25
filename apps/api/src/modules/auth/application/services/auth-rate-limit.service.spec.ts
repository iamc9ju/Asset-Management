import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import type { AuthEventRepository } from "../ports/auth-event.port";
import type {
  AuthRateLimitDecision,
  AuthRateLimiter,
} from "../ports/auth-rate-limiter.port";
import type { Clock } from "../ports/clock.port";
import { AUTH_RATE_LIMIT_POLICY } from "../../domain/auth-rate-limit-policy";
import { AuthRateLimitService } from "./auth-rate-limit.service";

const NOW = new Date("2026-09-25T08:00:00.000Z");
const CLIENT = {
  requestId: "11111111-1111-4111-8111-111111111111",
  ipAddress: "192.0.2.10",
  userAgent: "Rate limit service test",
} as const;
const ALLOWED: AuthRateLimitDecision = {
  allowed: true,
  retryAfterSeconds: 0,
  becameLimited: false,
};

function createService() {
  const rateLimiter: jest.Mocked<AuthRateLimiter> = {
    consume: jest.fn().mockResolvedValue(ALLOWED),
    inspect: jest.fn().mockResolvedValue(ALLOWED),
    reset: jest.fn(),
  };
  const authEventRepository: jest.Mocked<AuthEventRepository> = {
    recordLoginFailure: jest.fn(),
    recordRateLimitExceeded: jest.fn(),
    recordAuthorizationDenied: jest.fn(),
    recordRetentionCleanupCompleted: jest.fn(),
  };
  const clock: Clock = { now: () => new Date(NOW) };

  return {
    service: new AuthRateLimitService(
      rateLimiter,
      authEventRepository,
      clock,
    ),
    rateLimiter,
    authEventRepository,
  };
}

describe("AuthRateLimitService", () => {
  it("checks the login IP bucket and account failure bucket", async () => {
    const dependencies = createService();

    await expect(
      dependencies.service.assertLoginAllowed("user@example.com", CLIENT),
    ).resolves.toBeUndefined();

    expect(dependencies.rateLimiter.consume).toHaveBeenCalledWith({
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_IP,
      subject: CLIENT.ipAddress,
    });
    expect(dependencies.rateLimiter.inspect).toHaveBeenCalledWith({
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
      subject: "user@example.com",
    });
  });

  it("records an account failure without storing the credential", async () => {
    const dependencies = createService();

    await dependencies.service.recordLoginFailure(
      "user@example.com",
      null,
      CLIENT,
    );

    expect(dependencies.rateLimiter.consume).toHaveBeenCalledWith({
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
      subject: "user@example.com",
    });
  });

  it("resets only the account failure bucket after successful credentials", async () => {
    const dependencies = createService();

    await dependencies.service.recordLoginSuccess("user@example.com");

    expect(dependencies.rateLimiter.reset).toHaveBeenCalledWith({
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
      subject: "user@example.com",
    });
  });

  it("returns a typed retry contract and records the transition into a limited state", async () => {
    const dependencies = createService();
    dependencies.rateLimiter.consume.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 73,
      becameLimited: true,
    });

    await expect(
      dependencies.service.assertRefreshIpAllowed(CLIENT),
    ).rejects.toMatchObject({
      code: APP_ERROR_CODE.AUTH_RATE_LIMITED,
      retryAfterSeconds: 73,
      details: { retry_after_seconds: 73 },
    });
    expect(
      dependencies.authEventRepository.recordRateLimitExceeded,
    ).toHaveBeenCalledWith({
      targetUserId: null,
      policy: AUTH_RATE_LIMIT_POLICY.REFRESH_IP,
      occurredAt: NOW,
      client: CLIENT,
    });
  });

  it("does not amplify audit writes for a bucket that was already limited", async () => {
    const dependencies = createService();
    dependencies.rateLimiter.consume.mockResolvedValueOnce({
      allowed: false,
      retryAfterSeconds: 10,
      becameLimited: false,
    });

    await expect(
      dependencies.service.assertRefreshTokenAllowed(
        "22222222-2222-4222-8222-222222222222",
        CLIENT,
      ),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_RATE_LIMITED });
    expect(
      dependencies.authEventRepository.recordRateLimitExceeded,
    ).not.toHaveBeenCalled();
  });

  it("fails closed with 503 when Redis is unavailable", async () => {
    const dependencies = createService();
    dependencies.rateLimiter.consume.mockRejectedValueOnce(
      new Error("Redis unavailable"),
    );

    await expect(
      dependencies.service.assertRefreshIpAllowed(CLIENT),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.SERVICE_UNAVAILABLE });
    expect(
      dependencies.authEventRepository.recordRateLimitExceeded,
    ).not.toHaveBeenCalled();
  });
});
