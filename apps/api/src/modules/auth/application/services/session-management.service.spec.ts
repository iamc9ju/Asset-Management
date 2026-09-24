import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { PERMISSION_CODE } from "../../../iam/domain/permission-code";
import { USER_STATUS } from "../../../iam/domain/user-status";
import type { AuthenticatedIdentity } from "../../domain/authenticated-identity";
import { AUTH_SESSION_REVOKE_REASON } from "../../domain/auth.constants";
import type { Clock } from "../ports/clock.port";
import type { RefreshTokenService } from "../ports/refresh-token.port";
import type { SessionManagementRepository } from "../ports/session-management-repository.port";
import { ListAuthSessionsService } from "./list-auth-sessions.service";
import { LogoutService } from "./logout.service";
import { RevokeAllAuthSessionsService } from "./revoke-all-auth-sessions.service";
import { RevokeAuthSessionService } from "./revoke-auth-session.service";

const NOW = new Date("2026-09-24T08:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const CURRENT_SESSION_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_SESSION_ID = "44444444-4444-4444-8444-444444444444";
const TOKEN_ID = "55555555-5555-4555-8555-555555555555";
const CLIENT = {
  requestId: "66666666-6666-4666-8666-666666666666",
  ipAddress: "127.0.0.1",
  userAgent: "Session management service test",
} as const;

function createIdentity(
  permissionCodes: readonly string[] = [],
): AuthenticatedIdentity {
  return {
    userId: USER_ID,
    sessionId: CURRENT_SESSION_ID,
    displayName: "Session Owner",
    status: USER_STATUS.ACTIVE,
    permissionVersion: "1",
    permissionCodes,
  };
}

function createRepository(): jest.Mocked<SessionManagementRepository> {
  return {
    listActiveByUserId: jest.fn(),
    findById: jest.fn(),
    logoutByRefreshCredential: jest.fn(),
    revokeById: jest.fn(),
    revokeAllByUserId: jest.fn(),
  };
}

function createSession(userId = USER_ID, sessionId = CURRENT_SESSION_ID) {
  return {
    sessionId,
    userId,
    deviceLabel: "Chrome on macOS",
    createdAt: new Date("2026-09-23T08:00:00.000Z"),
    lastUsedAt: null,
    idleExpiresAt: new Date("2026-10-01T08:00:00.000Z"),
    absoluteExpiresAt: new Date("2026-10-24T08:00:00.000Z"),
    revokedAt: null,
  };
}

describe("LogoutService", () => {
  it("silently ignores malformed credentials", async () => {
    const refreshTokenService: jest.Mocked<RefreshTokenService> = {
      issue: jest.fn(),
      parseAndHash: jest.fn().mockReturnValue(null),
      hashesMatch: jest.fn(),
    };
    const repository = createRepository();
    const service = new LogoutService(refreshTokenService, repository, {
      now: () => new Date(NOW),
    });

    await expect(
      service.execute({ rawRefreshToken: "malformed", client: CLIENT }),
    ).resolves.toBeUndefined();
    expect(repository.logoutByRefreshCredential).not.toHaveBeenCalled();
  });

  it("delegates valid-looking credentials without exposing repository outcome", async () => {
    const refreshTokenService: jest.Mocked<RefreshTokenService> = {
      issue: jest.fn(),
      parseAndHash: jest.fn().mockReturnValue({
        tokenId: TOKEN_ID,
        tokenHash: "a".repeat(64),
      }),
      hashesMatch: jest.fn(),
    };
    const repository = createRepository();
    const service = new LogoutService(refreshTokenService, repository, {
      now: () => new Date(NOW),
    });

    await expect(
      service.execute({
        rawRefreshToken: `${TOKEN_ID}.secret`,
        client: CLIENT,
      }),
    ).resolves.toBeUndefined();
    expect(repository.logoutByRefreshCredential).toHaveBeenCalledWith({
      tokenId: TOKEN_ID,
      tokenHash: "a".repeat(64),
      occurredAt: NOW,
      client: CLIENT,
    });
  });
});

describe("ListAuthSessionsService", () => {
  it("lists the current user's active sessions without an elevated permission", async () => {
    const repository = createRepository();
    repository.listActiveByUserId.mockResolvedValue([
      createSession(),
      createSession(USER_ID, OTHER_SESSION_ID),
    ]);
    const service = new ListAuthSessionsService(repository, fixedClock());

    await expect(
      service.execute({ identity: createIdentity() }),
    ).resolves.toEqual([
      expect.objectContaining({
        sessionId: CURRENT_SESSION_ID,
        isCurrent: true,
      }),
      expect.objectContaining({
        sessionId: OTHER_SESSION_ID,
        isCurrent: false,
      }),
    ]);
    expect(repository.listActiveByUserId).toHaveBeenCalledWith(USER_ID, NOW);
  });

  it("rejects listing another user's sessions without session:read:any", async () => {
    const repository = createRepository();
    const service = new ListAuthSessionsService(repository, fixedClock());

    await expect(
      service.execute({
        identity: createIdentity(),
        targetUserId: OTHER_USER_ID,
      }),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_PERMISSION_DENIED });
    expect(repository.listActiveByUserId).not.toHaveBeenCalled();
  });

  it("allows an administrator to list another user's sessions", async () => {
    const repository = createRepository();
    repository.listActiveByUserId.mockResolvedValue([]);
    const service = new ListAuthSessionsService(repository, fixedClock());

    await expect(
      service.execute({
        identity: createIdentity([PERMISSION_CODE.SESSION_READ_ANY]),
        targetUserId: OTHER_USER_ID,
      }),
    ).resolves.toEqual([]);
    expect(repository.listActiveByUserId).toHaveBeenCalledWith(
      OTHER_USER_ID,
      NOW,
    );
  });
});

describe("RevokeAuthSessionService", () => {
  it("returns not found when the target session does not exist", async () => {
    const repository = createRepository();
    repository.findById.mockResolvedValue(null);
    const service = new RevokeAuthSessionService(repository, fixedClock());

    await expect(
      service.execute({
        identity: createIdentity(),
        sessionId: OTHER_SESSION_ID,
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.RESOURCE_NOT_FOUND });
  });

  it("rejects revoking another user's session without session:revoke:any", async () => {
    const repository = createRepository();
    repository.findById.mockResolvedValue(
      createSession(OTHER_USER_ID, OTHER_SESSION_ID),
    );
    const service = new RevokeAuthSessionService(repository, fixedClock());

    await expect(
      service.execute({
        identity: createIdentity(),
        sessionId: OTHER_SESSION_ID,
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_PERMISSION_DENIED });
    expect(repository.revokeById).not.toHaveBeenCalled();
  });

  it("revokes an owned current session and reports that the cookie must clear", async () => {
    const repository = createRepository();
    repository.findById.mockResolvedValue(createSession());
    repository.revokeById.mockResolvedValue(true);
    const service = new RevokeAuthSessionService(repository, fixedClock());

    await expect(
      service.execute({
        identity: createIdentity(),
        sessionId: CURRENT_SESSION_ID,
        client: CLIENT,
      }),
    ).resolves.toEqual({ revokedCurrentSession: true });
    expect(repository.revokeById).toHaveBeenCalledWith({
      sessionId: CURRENT_SESSION_ID,
      actorUserId: USER_ID,
      reason: AUTH_SESSION_REVOKE_REASON.USER_REVOKED_SESSION,
      occurredAt: NOW,
      client: CLIENT,
    });
  });

  it("allows an administrator to revoke another user's session", async () => {
    const repository = createRepository();
    repository.findById.mockResolvedValue(
      createSession(OTHER_USER_ID, OTHER_SESSION_ID),
    );
    repository.revokeById.mockResolvedValue(true);
    const service = new RevokeAuthSessionService(repository, fixedClock());

    await expect(
      service.execute({
        identity: createIdentity([PERMISSION_CODE.SESSION_REVOKE_ANY]),
        sessionId: OTHER_SESSION_ID,
        client: CLIENT,
      }),
    ).resolves.toEqual({ revokedCurrentSession: false });
    expect(repository.revokeById).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: USER_ID,
        reason: AUTH_SESSION_REVOKE_REASON.ADMIN_REVOKED_SESSION,
      }),
    );
  });
});

describe("RevokeAllAuthSessionsService", () => {
  it("revokes every own session, including the current session", async () => {
    const repository = createRepository();
    repository.revokeAllByUserId.mockResolvedValue(2);
    const service = new RevokeAllAuthSessionsService(repository, fixedClock());

    await expect(
      service.execute({ identity: createIdentity(), client: CLIENT }),
    ).resolves.toEqual({ revokedCurrentSession: true });
    expect(repository.revokeAllByUserId).toHaveBeenCalledWith({
      userId: USER_ID,
      actorUserId: USER_ID,
      reason: AUTH_SESSION_REVOKE_REASON.USER_REVOKED_ALL_SESSIONS,
      occurredAt: NOW,
      client: CLIENT,
    });
  });

  it("rejects revoking another user's sessions without session:revoke:any", async () => {
    const repository = createRepository();
    const service = new RevokeAllAuthSessionsService(repository, fixedClock());

    await expect(
      service.execute({
        identity: createIdentity(),
        targetUserId: OTHER_USER_ID,
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_PERMISSION_DENIED });
    expect(repository.revokeAllByUserId).not.toHaveBeenCalled();
  });

  it("allows an administrator to revoke every session for another user", async () => {
    const repository = createRepository();
    repository.revokeAllByUserId.mockResolvedValue(3);
    const service = new RevokeAllAuthSessionsService(repository, fixedClock());

    await expect(
      service.execute({
        identity: createIdentity([PERMISSION_CODE.SESSION_REVOKE_ANY]),
        targetUserId: OTHER_USER_ID,
        client: CLIENT,
      }),
    ).resolves.toEqual({ revokedCurrentSession: false });
    expect(repository.revokeAllByUserId).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: OTHER_USER_ID,
        actorUserId: USER_ID,
        reason: AUTH_SESSION_REVOKE_REASON.ADMIN_REVOKED_ALL_SESSIONS,
      }),
    );
  });
});

function fixedClock(): Clock {
  return { now: () => new Date(NOW) };
}
