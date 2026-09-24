import type { AuthClientContext } from "./auth-client-context.port";
import type { AuthSessionRevokeReason } from "../../domain/auth.constants";

export const SESSION_MANAGEMENT_REPOSITORY = Symbol(
  "SESSION_MANAGEMENT_REPOSITORY",
);

export interface ManagedAuthSession {
  readonly sessionId: string;
  readonly userId: string;
  readonly deviceLabel: string | null;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly revokedAt: Date | null;
}

export interface LogoutByRefreshCredentialInput {
  readonly tokenId: string;
  readonly tokenHash: string;
  readonly occurredAt: Date;
  readonly client: AuthClientContext;
}

export interface RevokeManagedSessionInput {
  readonly sessionId: string;
  readonly actorUserId: string;
  readonly reason: AuthSessionRevokeReason;
  readonly occurredAt: Date;
  readonly client: AuthClientContext;
}

export interface RevokeAllManagedSessionsInput {
  readonly userId: string;
  readonly actorUserId: string;
  readonly reason: AuthSessionRevokeReason;
  readonly occurredAt: Date;
  readonly client: AuthClientContext;
}

export interface SessionManagementRepository {
  listActiveByUserId(
    userId: string,
    activeAt: Date,
  ): Promise<readonly ManagedAuthSession[]>;

  findById(sessionId: string): Promise<ManagedAuthSession | null>;

  logoutByRefreshCredential(
    input: LogoutByRefreshCredentialInput,
  ): Promise<void>;

  revokeById(input: RevokeManagedSessionInput): Promise<boolean>;

  revokeAllByUserId(input: RevokeAllManagedSessionsInput): Promise<number>;
}
