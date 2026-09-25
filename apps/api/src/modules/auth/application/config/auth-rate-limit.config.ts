import type { AuthRateLimitPolicy } from "../../domain/auth-rate-limit-policy";

export interface AuthRateLimitPolicyConfig {
  readonly capacity: number;
  readonly windowSeconds: number;
}

export interface AuthRateLimitConfig {
  readonly namespace: string;
  readonly keySecret: string;
  readonly policies: Readonly<
    Record<AuthRateLimitPolicy, AuthRateLimitPolicyConfig>
  >;
}

export const AUTH_RATE_LIMIT_CONFIG = Symbol("AUTH_RATE_LIMIT_CONFIG");
