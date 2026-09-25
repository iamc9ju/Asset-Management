import { Inject, Injectable } from "@nestjs/common";
import type Redis from "ioredis";
import {
  AUTH_RATE_LIMIT_CONFIG,
  type AuthRateLimitConfig,
} from "../../application/config/auth-rate-limit.config";
import {
  type AuthRateLimitDecision,
  type AuthRateLimitInput,
  type AuthRateLimiter,
} from "../../application/ports/auth-rate-limiter.port";
import { REDIS_CLIENT } from "../../../../shared/infrastructure/infrastructure.constants";
import { AuthRateLimitKeyFactory } from "./auth-rate-limit-key.factory";
import { AUTH_RATE_LIMIT_TOKEN_BUCKET_SCRIPT } from "./redis-auth-rate-limiter.script";

const RATE_LIMIT_SCRIPT_RESULT_LENGTH = 3;

@Injectable()
export class RedisAuthRateLimiter implements AuthRateLimiter {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(AUTH_RATE_LIMIT_CONFIG)
    private readonly config: AuthRateLimitConfig,
    private readonly keyFactory: AuthRateLimitKeyFactory,
  ) {}

  consume(input: AuthRateLimitInput): Promise<AuthRateLimitDecision> {
    return this.evaluate(input, true);
  }

  inspect(input: AuthRateLimitInput): Promise<AuthRateLimitDecision> {
    return this.evaluate(input, false);
  }

  async reset(input: AuthRateLimitInput): Promise<void> {
    await this.redis.del(this.keyFactory.create(input));
  }

  private async evaluate(
    input: AuthRateLimitInput,
    consume: boolean,
  ): Promise<AuthRateLimitDecision> {
    const policy = this.config.policies[input.policy];
    const rawResult = await this.redis.eval(
      AUTH_RATE_LIMIT_TOKEN_BUCKET_SCRIPT,
      1,
      this.keyFactory.create(input),
      policy.capacity,
      policy.windowSeconds * 1_000,
      consume ? 1 : 0,
    );

    return parseScriptResult(rawResult);
  }
}

function parseScriptResult(result: unknown): AuthRateLimitDecision {
  if (!Array.isArray(result) || result.length !== RATE_LIMIT_SCRIPT_RESULT_LENGTH) {
    throw new TypeError("Redis returned an invalid authentication rate-limit result.");
  }

  const allowed = Number(result[0]);
  const retryAfterSeconds = Number(result[1]);
  const becameLimited = Number(result[2]);

  if (
    ![allowed, retryAfterSeconds, becameLimited].every(Number.isSafeInteger) ||
    (allowed !== 0 && allowed !== 1) ||
    (becameLimited !== 0 && becameLimited !== 1) ||
    retryAfterSeconds < 0
  ) {
    throw new TypeError("Redis returned an invalid authentication rate-limit value.");
  }

  return {
    allowed: allowed === 1,
    retryAfterSeconds,
    becameLimited: becameLimited === 1,
  };
}
