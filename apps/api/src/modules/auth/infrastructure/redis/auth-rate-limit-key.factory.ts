import { createHmac } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  AUTH_RATE_LIMIT_CONFIG,
  type AuthRateLimitConfig,
} from "../../application/config/auth-rate-limit.config";
import type { AuthRateLimitInput } from "../../application/ports/auth-rate-limiter.port";

const RATE_LIMIT_KEY_VERSION = "v1";

@Injectable()
export class AuthRateLimitKeyFactory {
  constructor(
    @Inject(AUTH_RATE_LIMIT_CONFIG)
    private readonly config: AuthRateLimitConfig,
  ) {}

  create(input: AuthRateLimitInput): string {
    const subjectDigest = createHmac("sha256", this.config.keySecret)
      .update(input.subject, "utf8")
      .digest("hex");

    return [
      this.config.namespace,
      "auth-rate",
      RATE_LIMIT_KEY_VERSION,
      input.policy.toLowerCase(),
      subjectDigest,
    ].join(":");
  }
}
