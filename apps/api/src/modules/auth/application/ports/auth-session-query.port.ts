export const AUTH_SESSION_QUERY = Symbol("AUTH_SESSION_QUERY");

export interface AuthSessionState {
  readonly sessionId: string;
  readonly userId: string;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface AuthSessionQuery {
  findByIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<AuthSessionState | null>;
}
