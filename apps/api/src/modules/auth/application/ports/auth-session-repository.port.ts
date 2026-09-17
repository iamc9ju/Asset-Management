export const AUTH_SESSION_REPOSITORY = Symbol("AUTH_SESSION_REPOSITORY");

export const CREATE_LOGIN_SESSION_RESULT = {
  CREATED: "created",
  USER_NOT_ACTIVE: "user_not_active",
} as const;

export type CreateLoginSessionResult =
  (typeof CREATE_LOGIN_SESSION_RESULT)[keyof typeof CREATE_LOGIN_SESSION_RESULT];

export interface LoginClientContext {
  readonly requestId: string;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface CreateLoginSessionInput {
  readonly sessionId: string;
  readonly userId: string;
  readonly deviceLabel: string | null;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly refreshTokenId: string;
  readonly refreshTokenHash: string;
  readonly occurredAt: Date;
  readonly client: LoginClientContext;
}

export interface AuthSessionRepository {
  createLoginSession(
    input: CreateLoginSessionInput,
  ): Promise<CreateLoginSessionResult>;
}
