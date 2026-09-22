import type { AuthClientContext } from "./auth-client-context.port";

export const REFRESH_SESSION_REPOSITORY = Symbol("REFRESH_SESSION_REPOSITORY");

export const ROTATE_REFRESH_SESSION_RESULT = {
  ROTATED: "rotated",
  INVALID: "invalid",
  EXPIRED: "expired",
  REUSED: "reused",
} as const;

export interface RotateRefreshSessionInput {
  readonly currentTokenId: string;
  readonly currentTokenHash: string;
  readonly replacementTokenId: string;
  readonly replacementTokenHash: string;
  readonly idleTtlSeconds: number;
  readonly occurredAt: Date;
  readonly client: AuthClientContext;
}

export type RotateRefreshSessionResult =
  | {
      readonly status: typeof ROTATE_REFRESH_SESSION_RESULT.ROTATED;
      readonly userId: string;
      readonly sessionId: string;
      readonly refreshTokenExpiresAt: Date;
    }
  | {
      readonly status:
        | typeof ROTATE_REFRESH_SESSION_RESULT.INVALID
        | typeof ROTATE_REFRESH_SESSION_RESULT.EXPIRED
        | typeof ROTATE_REFRESH_SESSION_RESULT.REUSED;
    };

export interface RefreshSessionRepository {
  rotate(input: RotateRefreshSessionInput): Promise<RotateRefreshSessionResult>;
}
