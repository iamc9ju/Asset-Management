import { Inject, Injectable } from "@nestjs/common";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import { AUTH_RATE_LIMIT_POLICY } from "../../domain/auth-rate-limit-policy";
import {
  AUTH_EVENT_REPOSITORY,
  type AuthEventRepository,
} from "../ports/auth-event.port";
import type { AuthClientContext } from "../ports/auth-client-context.port";
import {
  AUTH_RATE_LIMITER,
  type AuthRateLimitDecision,
  type AuthRateLimitInput,
  type AuthRateLimiter,
} from "../ports/auth-rate-limiter.port";
import { CLOCK, type Clock } from "../ports/clock.port";

const UNKNOWN_CLIENT_IP_SUBJECT = "unknown-client-ip";

@Injectable()
export class AuthRateLimitService {
  constructor(
    @Inject(AUTH_RATE_LIMITER)
    private readonly rateLimiter: AuthRateLimiter,
    @Inject(AUTH_EVENT_REPOSITORY)
    private readonly authEventRepository: AuthEventRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async assertLoginAllowed(
    normalizedEmail: string,
    client: AuthClientContext,
  ): Promise<void> {
    await this.consumeOrReject(
      {
        policy: AUTH_RATE_LIMIT_POLICY.LOGIN_IP,
        subject: client.ipAddress ?? UNKNOWN_CLIENT_IP_SUBJECT,
      },
      client,
      null,
    );
    await this.inspectOrReject(
      {
        policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
        subject: normalizedEmail,
      },
      client,
      null,
    );
  }

  async recordLoginFailure(
    normalizedEmail: string,
    targetUserId: string | null,
    client: AuthClientContext,
  ): Promise<void> {
    await this.consumeOrReject(
      {
        policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
        subject: normalizedEmail,
      },
      client,
      targetUserId,
    );
  }

  async recordLoginSuccess(normalizedEmail: string): Promise<void> {
    await this.runRedisOperation(() =>
      this.rateLimiter.reset({
        policy: AUTH_RATE_LIMIT_POLICY.LOGIN_ACCOUNT,
        subject: normalizedEmail,
      }),
    );
  }

  async assertRefreshIpAllowed(client: AuthClientContext): Promise<void> {
    await this.consumeOrReject(
      {
        policy: AUTH_RATE_LIMIT_POLICY.REFRESH_IP,
        subject: client.ipAddress ?? UNKNOWN_CLIENT_IP_SUBJECT,
      },
      client,
      null,
    );
  }

  async assertRefreshTokenAllowed(
    tokenId: string,
    client: AuthClientContext,
  ): Promise<void> {
    await this.consumeOrReject(
      {
        policy: AUTH_RATE_LIMIT_POLICY.REFRESH_TOKEN,
        subject: tokenId,
      },
      client,
      null,
    );
  }

  private async consumeOrReject(
    input: AuthRateLimitInput,
    client: AuthClientContext,
    targetUserId: string | null,
  ): Promise<void> {
    const decision = await this.runRedisOperation(() =>
      this.rateLimiter.consume(input),
    );
    await this.rejectWhenLimited(input, decision, client, targetUserId);
  }

  private async inspectOrReject(
    input: AuthRateLimitInput,
    client: AuthClientContext,
    targetUserId: string | null,
  ): Promise<void> {
    const decision = await this.runRedisOperation(() =>
      this.rateLimiter.inspect(input),
    );
    await this.rejectWhenLimited(input, decision, client, targetUserId);
  }

  private async rejectWhenLimited(
    input: AuthRateLimitInput,
    decision: AuthRateLimitDecision,
    client: AuthClientContext,
    targetUserId: string | null,
  ): Promise<void> {
    if (decision.allowed) {
      return;
    }

    if (decision.becameLimited) {
      await this.authEventRepository.recordRateLimitExceeded({
        targetUserId,
        policy: input.policy,
        occurredAt: this.clock.now(),
        client,
      });
    }

    throw new AppError(APP_ERROR_CODE.AUTH_RATE_LIMITED, {
      retryAfterSeconds: decision.retryAfterSeconds,
      details: { retry_after_seconds: decision.retryAfterSeconds },
    });
  }

  private async runRedisOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(APP_ERROR_CODE.SERVICE_UNAVAILABLE, { cause: error });
    }
  }
}
