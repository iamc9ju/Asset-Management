import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import type { AccessTokenConfig } from "../config/access-token.config";
import type { AuthSessionConfig } from "../config/auth-session.config";
import type { AccessTokenService } from "../ports/access-token.port";
import type { Clock } from "../ports/clock.port";
import {
  ROTATE_REFRESH_SESSION_RESULT,
  type RefreshSessionRepository,
} from "../ports/refresh-session-repository.port";
import type { RefreshTokenService } from "../ports/refresh-token.port";
import { AUTH_TOKEN_TYPE } from "../../domain/auth.constants";
import { RefreshSessionService } from "./refresh-session.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";

const NOW = new Date("2026-09-21T08:00:00.000Z");
const REFRESH_EXPIRES_AT = new Date("2026-10-21T08:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const CURRENT_TOKEN_ID = "33333333-3333-4333-8333-333333333333";
const REPLACEMENT_TOKEN_ID = "44444444-4444-4444-8444-444444444444";
const CLIENT = {
  requestId: "55555555-5555-4555-8555-555555555555",
  ipAddress: "127.0.0.1",
  userAgent: "Refresh service test",
} as const;

function createService() {
  const refreshTokenService: jest.Mocked<RefreshTokenService> = {
    issue: jest.fn(),
    parseAndHash: jest.fn(),
    hashesMatch: jest.fn(),
  };
  const refreshSessionRepository: jest.Mocked<RefreshSessionRepository> = {
    rotate: jest.fn(),
  };
  const accessTokenService: jest.Mocked<AccessTokenService> = {
    issue: jest.fn(),
    verify: jest.fn(),
  };
  const clock: Clock = { now: () => new Date(NOW) };
  const accessTokenConfig: AccessTokenConfig = {
    issuer: "test-issuer",
    audience: "test-audience",
    ttlSeconds: 900,
    currentKey: { id: "v1", secret: "test-secret" },
  };
  const authSessionConfig: AuthSessionConfig = {
    idleTtlSeconds: 604_800,
    absoluteTtlSeconds: 2_592_000,
    refreshCookieSecure: true,
  };
  const authRateLimitService = {
    assertLoginAllowed: jest.fn(),
    recordLoginFailure: jest.fn(),
    recordLoginSuccess: jest.fn(),
    assertRefreshIpAllowed: jest.fn(),
    assertRefreshTokenAllowed: jest.fn(),
  } as unknown as jest.Mocked<AuthRateLimitService>;
  const service = new RefreshSessionService(
    refreshTokenService,
    refreshSessionRepository,
    accessTokenService,
    clock,
    accessTokenConfig,
    authSessionConfig,
    authRateLimitService,
  );

  refreshTokenService.parseAndHash.mockReturnValue({
    tokenId: CURRENT_TOKEN_ID,
    tokenHash: "a".repeat(64),
  });
  refreshTokenService.issue.mockReturnValue({
    tokenId: REPLACEMENT_TOKEN_ID,
    tokenHash: "b".repeat(64),
    rawToken: `${REPLACEMENT_TOKEN_ID}.replacement-secret`,
  });

  return {
    service,
    refreshTokenService,
    refreshSessionRepository,
    accessTokenService,
    authRateLimitService,
  };
}

describe("RefreshSessionService", () => {
  it("rotates the refresh credential and issues a new access token", async () => {
    const dependencies = createService();
    dependencies.refreshSessionRepository.rotate.mockResolvedValue({
      status: ROTATE_REFRESH_SESSION_RESULT.ROTATED,
      userId: USER_ID,
      sessionId: SESSION_ID,
      refreshTokenExpiresAt: REFRESH_EXPIRES_AT,
    });
    dependencies.accessTokenService.issue.mockResolvedValue("access-token");

    await expect(
      dependencies.service.execute({
        rawRefreshToken: `${CURRENT_TOKEN_ID}.current-secret`,
        client: CLIENT,
      }),
    ).resolves.toEqual({
      accessToken: "access-token",
      tokenType: AUTH_TOKEN_TYPE.BEARER,
      expiresIn: 900,
      refreshToken: `${REPLACEMENT_TOKEN_ID}.replacement-secret`,
      refreshTokenExpiresAt: REFRESH_EXPIRES_AT,
    });
    expect(dependencies.refreshSessionRepository.rotate).toHaveBeenCalledWith({
      currentTokenId: CURRENT_TOKEN_ID,
      currentTokenHash: "a".repeat(64),
      replacementTokenId: REPLACEMENT_TOKEN_ID,
      replacementTokenHash: "b".repeat(64),
      idleTtlSeconds: 604_800,
      occurredAt: NOW,
      client: CLIENT,
    });
    expect(dependencies.accessTokenService.issue).toHaveBeenCalledWith({
      userId: USER_ID,
      sessionId: SESSION_ID,
    });
  });

  it("rejects malformed credentials before generating a successor", async () => {
    const dependencies = createService();
    dependencies.refreshTokenService.parseAndHash.mockReturnValue(null);

    await expect(
      dependencies.service.execute({
        rawRefreshToken: "malformed",
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_SESSION_INVALID });
    expect(dependencies.refreshTokenService.issue).not.toHaveBeenCalled();
    expect(dependencies.refreshSessionRepository.rotate).not.toHaveBeenCalled();
  });

  it.each([
    ROTATE_REFRESH_SESSION_RESULT.INVALID,
    ROTATE_REFRESH_SESSION_RESULT.REUSED,
  ])(
    "maps the %s result to the generic invalid-session error",
    async (status) => {
      const dependencies = createService();
      dependencies.refreshSessionRepository.rotate.mockResolvedValue({
        status,
      });

      await expect(
        dependencies.service.execute({
          rawRefreshToken: `${CURRENT_TOKEN_ID}.current-secret`,
          client: CLIENT,
        }),
      ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_SESSION_INVALID });
      expect(dependencies.accessTokenService.issue).not.toHaveBeenCalled();
    },
  );

  it("maps an expired session to the expired-session error", async () => {
    const dependencies = createService();
    dependencies.refreshSessionRepository.rotate.mockResolvedValue({
      status: ROTATE_REFRESH_SESSION_RESULT.EXPIRED,
    });

    await expect(
      dependencies.service.execute({
        rawRefreshToken: `${CURRENT_TOKEN_ID}.current-secret`,
        client: CLIENT,
      }),
    ).rejects.toMatchObject({ code: APP_ERROR_CODE.AUTH_SESSION_EXPIRED });
    expect(dependencies.accessTokenService.issue).not.toHaveBeenCalled();
  });
});
