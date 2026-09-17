import type { LoginClientContext } from "./auth-session-repository.port";

export const AUTH_EVENT_REPOSITORY = Symbol("AUTH_EVENT_REPOSITORY");

export const AUTH_EVENT_ACTION = {
  LOGIN_SUCCEEDED: "LOGIN_SUCCEEDED",
  LOGIN_FAILED: "LOGIN_FAILED",
} as const;

export const LOGIN_FAILURE_REASON = {
  UNKNOWN_IDENTITY: "UNKNOWN_IDENTITY",
  INVALID_PASSWORD: "INVALID_PASSWORD",
  ACCOUNT_NOT_ACTIVE: "ACCOUNT_NOT_ACTIVE",
} as const;

export type LoginFailureReason =
  (typeof LOGIN_FAILURE_REASON)[keyof typeof LOGIN_FAILURE_REASON];

export interface RecordLoginFailureInput {
  readonly targetUserId: string | null;
  readonly reason: LoginFailureReason;
  readonly occurredAt: Date;
  readonly client: LoginClientContext;
}

export interface AuthEventRepository {
  recordLoginFailure(input: RecordLoginFailureInput): Promise<void>;
}
