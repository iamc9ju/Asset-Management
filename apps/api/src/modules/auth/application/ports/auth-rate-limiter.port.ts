import type { AuthRateLimitPolicy } from "../../domain/auth-rate-limit-policy";

export const AUTH_RATE_LIMITER = Symbol("AUTH_RATE_LIMITER");

export interface AuthRateLimitInput {
  readonly policy: AuthRateLimitPolicy;
  readonly subject: string;
}

export interface AuthRateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
  readonly becameLimited: boolean;
}

export interface AuthRateLimiter {
  consume(input: AuthRateLimitInput): Promise<AuthRateLimitDecision>;
  inspect(input: AuthRateLimitInput): Promise<AuthRateLimitDecision>;
  reset(input: AuthRateLimitInput): Promise<void>;
}
