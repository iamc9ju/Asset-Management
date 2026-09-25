import type { AuthClientContext } from "./auth-client-context.port";
import type { AuthRateLimitPolicy } from "../../domain/auth-rate-limit-policy";
import type { PermissionCode } from "../../../iam/domain/permission-code";

export const AUTH_EVENT_REPOSITORY = Symbol("AUTH_EVENT_REPOSITORY");

export const AUTH_EVENT_ACTION = {
  LOGIN_SUCCEEDED: "LOGIN_SUCCEEDED",
  LOGIN_FAILED: "LOGIN_FAILED",
  TOKEN_REFRESHED: "TOKEN_REFRESHED",
  REFRESH_TOKEN_REUSE_DETECTED: "REFRESH_TOKEN_REUSE_DETECTED",
  LOGOUT_SUCCEEDED: "LOGOUT_SUCCEEDED",
  SESSION_REVOKED: "SESSION_REVOKED",
  AUTH_RATE_LIMITED: "AUTH_RATE_LIMITED",
  AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
  AUTH_RETENTION_CLEANUP_COMPLETED: "AUTH_RETENTION_CLEANUP_COMPLETED",
} as const;

export const LOGIN_FAILURE_REASON = {
  UNKNOWN_IDENTITY: "UNKNOWN_IDENTITY",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  ACCOUNT_NOT_ACTIVE: "ACCOUNT_NOT_ACTIVE",
} as const;

export const AUTHORIZATION_DENIAL_REASON = {
  MISSING_REQUIRED_PERMISSION: "MISSING_REQUIRED_PERMISSION",
  MISSING_PERMISSION_METADATA: "MISSING_PERMISSION_METADATA",
} as const;

export type AuthorizationDenialReason =
  (typeof AUTHORIZATION_DENIAL_REASON)[keyof typeof AUTHORIZATION_DENIAL_REASON];

export type LoginFailureReason =
  (typeof LOGIN_FAILURE_REASON)[keyof typeof LOGIN_FAILURE_REASON];

export interface RecordLoginFailureInput {
  readonly targetUserId: string | null;
  readonly reason: LoginFailureReason;
  readonly occurredAt: Date;
  readonly client: AuthClientContext;
}

export interface RecordRateLimitExceededInput {
  readonly targetUserId: string | null;
  readonly policy: AuthRateLimitPolicy;
  readonly occurredAt: Date;
  readonly client: AuthClientContext;
}

export interface RecordAuthorizationDeniedInput {
  readonly actorUserId: string;
  readonly sessionId: string;
  readonly requiredPermissions: readonly PermissionCode[];
  readonly reason: AuthorizationDenialReason;
  readonly occurredAt: Date;
  readonly client: AuthClientContext;
}

export interface RecordRetentionCleanupCompletedInput {
  readonly cutoff: Date;
  readonly deletedSessions: number;
  readonly completedBatches: number;
  readonly hasMore: boolean;
  readonly occurredAt: Date;
  readonly client: AuthClientContext;
}

export interface AuthEventRepository {
  recordLoginFailure(input: RecordLoginFailureInput): Promise<void>;
  recordRateLimitExceeded(input: RecordRateLimitExceededInput): Promise<void>;
  recordAuthorizationDenied(input: RecordAuthorizationDeniedInput): Promise<void>;
  recordRetentionCleanupCompleted(
    input: RecordRetentionCleanupCompletedInput,
  ): Promise<void>;
}
