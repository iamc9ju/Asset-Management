import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import type { IamAuthQuery } from "../../../iam/application/ports/iam-auth-query.port";
import { USER_STATUS, type UserStatus } from "../../../iam/domain/user-status";
import type { AccessTokenService } from "../ports/access-token.port";
import type { AuthSessionQuery } from "../ports/auth-session-query.port";
import type { Clock } from "../ports/clock.port";
import { AuthenticateAccessTokenService } from "./authenticate-access-token.service";

const NOW = new Date("2026-09-20T08:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN_ID = "33333333-3333-4333-8333-333333333333";
const ACCESS_TOKEN = "header.payload.signature";

function createService() {
  const accessTokenService: jest.Mocked<AccessTokenService> = {
    issue: jest.fn(),
    verify: jest.fn(),
  };
  const authSessionQuery: jest.Mocked<AuthSessionQuery> = {
    findByIdAndUserId: jest.fn(),
  };
  const iamAuthQuery: jest.Mocked<IamAuthQuery> = {
    findAuthenticationUserByEmail: jest.fn(),
    findAuthorizationContextByUserId: jest.fn(),
  };
  const clock: Clock = { now: () => new Date(NOW) };
  const service = new AuthenticateAccessTokenService(
    accessTokenService,
    authSessionQuery,
    iamAuthQuery,
    clock,
  );

  return { service, accessTokenService, authSessionQuery, iamAuthQuery };
}

function validClaims() {
  return {
    userId: USER_ID,
    sessionId: SESSION_ID,
    tokenId: TOKEN_ID,
    issuedAt: Math.floor(NOW.getTime() / 1_000) - 60,
    expiresAt: Math.floor(NOW.getTime() / 1_000) + 840,
  };
}

function activeSession(
  overrides: Partial<{
    sessionId: string;
    userId: string;
    idleExpiresAt: Date;
    absoluteExpiresAt: Date;
    revokedAt: Date | null;
  }> = {},
) {
  return {
    sessionId: overrides.sessionId ?? SESSION_ID,
    userId: overrides.userId ?? USER_ID,
    idleExpiresAt:
      overrides.idleExpiresAt ?? new Date("2026-09-20T09:00:00.000Z"),
    absoluteExpiresAt:
      overrides.absoluteExpiresAt ?? new Date("2026-09-27T08:00:00.000Z"),
    revokedAt: overrides.revokedAt ?? null,
  };
}

function authorizationContext(status: UserStatus = USER_STATUS.ACTIVE) {
  return {
    userId: USER_ID,
    email: "user@example.com",
    displayName: "Test User",
    status,
    permissionVersion: "7",
    permissionCodes: ["assets:read", "assets:update"],
  };
}

function arrangeVerifiedRequest(
  dependencies: ReturnType<typeof createService>,
): void {
  dependencies.accessTokenService.verify.mockResolvedValue({
    valid: true,
    claims: validClaims(),
  });
  dependencies.authSessionQuery.findByIdAndUserId.mockResolvedValue(
    activeSession(),
  );
  dependencies.iamAuthQuery.findAuthorizationContextByUserId.mockResolvedValue(
    authorizationContext(),
  );
}

describe("AuthenticateAccessTokenService", () => {
  it.each([
    {
      reason: "invalid" as const,
      expectedCode: APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID,
    },
    {
      reason: "expired" as const,
      expectedCode: APP_ERROR_CODE.AUTH_ACCESS_TOKEN_EXPIRED,
    },
  ])(
    "rejects a $reason access token before database access",
    async (scenario) => {
      const dependencies = createService();
      dependencies.accessTokenService.verify.mockResolvedValue({
        valid: false,
        reason: scenario.reason,
      });

      await expect(
        dependencies.service.execute(ACCESS_TOKEN),
      ).rejects.toMatchObject({ code: scenario.expectedCode });

      expect(
        dependencies.authSessionQuery.findByIdAndUserId,
      ).not.toHaveBeenCalled();
      expect(
        dependencies.iamAuthQuery.findAuthorizationContextByUserId,
      ).not.toHaveBeenCalled();
    },
  );

  it.each([
    { name: "missing", session: null },
    {
      name: "revoked",
      session: activeSession({ revokedAt: new Date("2026-09-20T07:00:00Z") }),
    },
    {
      name: "user-mismatched",
      session: activeSession({
        userId: "44444444-4444-4444-8444-444444444444",
      }),
    },
  ])("rejects a $name session", async ({ session }) => {
    const dependencies = createService();
    arrangeVerifiedRequest(dependencies);
    dependencies.authSessionQuery.findByIdAndUserId.mockResolvedValue(session);

    await expect(
      dependencies.service.execute(ACCESS_TOKEN),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_SESSION_INVALID });
  });

  it.each([
    {
      name: "idle expiration",
      session: activeSession({ idleExpiresAt: NOW }),
    },
    {
      name: "absolute expiration",
      session: activeSession({ absoluteExpiresAt: NOW }),
    },
  ])("rejects a session at its $name boundary", async ({ session }) => {
    const dependencies = createService();
    arrangeVerifiedRequest(dependencies);
    dependencies.authSessionQuery.findByIdAndUserId.mockResolvedValue(session);

    await expect(
      dependencies.service.execute(ACCESS_TOKEN),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_SESSION_EXPIRED });
  });

  it.each([
    { name: "missing", user: null },
    {
      name: "inactive",
      user: authorizationContext(USER_STATUS.INACTIVE),
    },
    {
      name: "suspended",
      user: authorizationContext(USER_STATUS.SUSPENDED),
    },
    {
      name: "identity-mismatched",
      user: {
        ...authorizationContext(),
        userId: "44444444-4444-4444-8444-444444444444",
      },
    },
  ])("rejects a $name user", async ({ user }) => {
    const dependencies = createService();
    arrangeVerifiedRequest(dependencies);
    dependencies.iamAuthQuery.findAuthorizationContextByUserId.mockResolvedValue(
      user,
    );

    await expect(
      dependencies.service.execute(ACCESS_TOKEN),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_SESSION_INVALID });
  });

  it("returns a request-scoped authenticated identity from current database state", async () => {
    const dependencies = createService();
    arrangeVerifiedRequest(dependencies);

    await expect(dependencies.service.execute(ACCESS_TOKEN)).resolves.toEqual({
      userId: USER_ID,
      sessionId: SESSION_ID,
      displayName: "Test User",
      status: USER_STATUS.ACTIVE,
      permissionVersion: "7",
      permissionCodes: ["assets:read", "assets:update"],
    });

    expect(dependencies.accessTokenService.verify).toHaveBeenCalledWith(
      ACCESS_TOKEN,
    );
    expect(
      dependencies.authSessionQuery.findByIdAndUserId,
    ).toHaveBeenCalledWith(SESSION_ID, USER_ID);
    expect(
      dependencies.iamAuthQuery.findAuthorizationContextByUserId,
    ).toHaveBeenCalledWith(USER_ID);
  });
});
