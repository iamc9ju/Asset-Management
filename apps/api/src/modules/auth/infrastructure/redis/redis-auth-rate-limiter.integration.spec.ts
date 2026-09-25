import "dotenv/config";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";
import type { AuthRateLimitConfig } from "../../application/config/auth-rate-limit.config";
import { AUTH_RATE_LIMIT_POLICY } from "../../domain/auth-rate-limit-policy";
import { AuthRateLimitKeyFactory } from "./auth-rate-limit-key.factory";
import { RedisAuthRateLimiter } from "./redis-auth-rate-limiter";

const REDIS_URL = getRequiredRedisUrl();

describe("RedisAuthRateLimiter integration", () => {
  const namespace = `asset-management-test-${randomUUID()}`;
  const config: AuthRateLimitConfig = {
    namespace,
    keySecret: "rate-limit-test-secret-with-at-least-256-bits-of-entropy",
    policies: {
      [AUTH_RATE_LIMIT_POLICY.LOGIN_IP]: {
        capacity: 3,
        windowSeconds: 60,
      },
      [AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT]: {
        capacity: 3,
        windowSeconds: 60,
      },
      [AUTH_RATE_LIMIT_POLICY.REFRESH_IP]: {
        capacity: 3,
        windowSeconds: 60,
      },
      [AUTH_RATE_LIMIT_POLICY.REFRESH_TOKEN]: {
        capacity: 3,
        windowSeconds: 60,
      },
    },
  };
  const redis = new Redis(REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  const keyFactory = new AuthRateLimitKeyFactory(config);
  const limiter = new RedisAuthRateLimiter(redis, config, keyFactory);
  const createdKeys = new Set<string>();

  beforeAll(async () => {
    await redis.connect();
  });

  afterAll(async () => {
    if (createdKeys.size > 0) {
      await redis.del(...createdKeys);
    }
    await redis.quit();
  });

  it("enforces the capacity atomically under concurrent requests", async () => {
    const input = {
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_IP,
      subject: "192.0.2.25",
    } as const;
    createdKeys.add(keyFactory.create(input));

    const decisions = await Promise.all(
      Array.from({ length: 8 }, () => limiter.consume(input)),
    );

    expect(decisions.filter((decision) => decision.allowed)).toHaveLength(3);
    expect(decisions.filter((decision) => !decision.allowed)).toHaveLength(5);
    expect(
      decisions.filter((decision) => decision.becameLimited),
    ).toHaveLength(1);
    expect(
      decisions
        .filter((decision) => !decision.allowed)
        .every((decision) => decision.retryAfterSeconds > 0),
    ).toBe(true);
  });

  it("inspects and resets a bucket without exposing the raw subject", async () => {
    const input = {
      policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
      subject: "sensitive.user@example.com",
    } as const;
    const key = keyFactory.create(input);
    createdKeys.add(key);

    await expect(limiter.inspect(input)).resolves.toMatchObject({
      allowed: true,
    });
    expect(key).not.toContain(input.subject);
    await limiter.reset(input);
    await expect(redis.exists(key)).resolves.toBe(0);
  });
});

function getRequiredRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error(
      "REDIS_URL must be configured to run Redis integration tests.",
    );
  }

  return redisUrl;
}
