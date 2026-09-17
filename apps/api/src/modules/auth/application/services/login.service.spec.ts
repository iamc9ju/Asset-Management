import type { AccessTokenConfig } from "../config/access-token.config";
import type { AuthSessionConfig } from "../config/auth-session.config";
import type { AuthEventRepository } from "../ports/auth-event.port";
import { LOGIN_FAILURE_REASON } from "../ports/auth-event.port";
import type { AuthSessionRepository } from "../ports/auth-session-repository.port";
import { CREATE_LOGIN_SESSION_RESULT } from "../ports/auth-session-repository.port";
import type { AccessTokenService } from "../ports/access-token.port";
import type { Clock } from "../ports/clock.port";
import type { IdentifierGenerator } from "../ports/identifier-generator.port";
import type { PasswordHasher } from "../ports/password-hasher.port";
import type { RefreshTokenService } from "../ports/refresh-token.port";
import type { IamAuthQuery } from "../../../iam/application/ports/iam-auth-query.port";
import {
  USER_STATUS,
  type UserStatus,
} from "../../../iam/domain/user-status";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import { AUTH_TOKEN_TYPE } from "../../domain/auth.constants";
import { LoginService } from "./login.service";

const NOW = new Date("2026-09-17T08:00:00.000Z");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const REFRESH_TOKEN_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT = {
  requestId: "44444444-4444-4444-8444-444444444444",
  ipAddress: "127.0.0.1",
  userAgent: "Login service test",
} as const;

function createService() {
  const iamAuthQuery: jest.Mocked<IamAuthQuery> = {
    findAuthenticationUserByEmail: jest.fn(),
    findAuthorizationContextByUserId: jest.fn(),
  };
  const passwordHasher: jest.Mocked<PasswordHasher> = {
    hash: jest.fn(),
    verify: jest.fn(),
    consumeVerificationCost: jest.fn(),
  };
  const accessTokenService: jest.Mocked<AccessTokenService> = {
    issue: jest.fn(),
    verify: jest.fn(),
  };
  const refreshTokenService: jest.Mocked<RefreshTokenService> = {
    issue: jest.fn(),
    parseAndHash: jest.fn(),
    hashesMatch: jest.fn(),
  };
  const authSessionRepository: jest.Mocked<AuthSessionRepository> = {
    createLoginSession: jest.fn(),
  };
  const authEventRepository: jest.Mocked<AuthEventRepository> = {
    recordLoginFailure: jest.fn(),
  };
  const identifierGenerator: jest.Mocked<IdentifierGenerator> = {
    generate: jest.fn(),
  };
  const clock: Clock = { now: () => new Date(NOW) };
  const accessTokenConfig: AccessTokenConfig = {
    issuer: "test-issuer",
    audience: "test-audience",
    ttlSeconds: 900,
    currentKey: { id: "v1", secret: "test-secret" },
  };
  const authSessionConfig: AuthSessionConfig = {
    idleTtlSeconds: 600,
    absoluteTtlSeconds: 3_600,
    refreshCookieSecure: true,
  };

  const service = new LoginService(
    iamAuthQuery,
    passwordHasher,
    accessTokenService,
    refreshTokenService,
    authSessionRepository,
    authEventRepository,
    identifierGenerator,
    clock,
    accessTokenConfig,
    authSessionConfig,
  );

  return {
    service,
    iamAuthQuery,
    passwordHasher,
    accessTokenService,
    refreshTokenService,
    authSessionRepository,
    authEventRepository,
    identifierGenerator,
  };
}

function authenticationUser(status: UserStatus = USER_STATUS.ACTIVE) {
  return {
    id: USER_ID,
    email: "User@example.com",
    passwordHash: "$argon2id$test-hash",
    displayName: "Test User",
    status,
    permissionVersion: "1",
  };
}

describe("LoginService", () => {
  it("creates the initial session and tokens for an active user", async () => {
    const dependencies = createService();
    dependencies.iamAuthQuery.findAuthenticationUserByEmail.mockResolvedValue(
      authenticationUser(),
    );
    dependencies.passwordHasher.verify.mockResolvedValue(true);
    dependencies.identifierGenerator.generate.mockReturnValue(SESSION_ID);
    dependencies.refreshTokenService.issue.mockReturnValue({
      tokenId: REFRESH_TOKEN_ID,
      rawToken: `${REFRESH_TOKEN_ID}.refresh-secret`,
      tokenHash: "a".repeat(64),
    });
    dependencies.accessTokenService.issue.mockResolvedValue("access-token");
    dependencies.authSessionRepository.createLoginSession.mockResolvedValue(
      CREATE_LOGIN_SESSION_RESULT.CREATED,
    );

    await expect(
      dependencies.service.execute({
        email: "  User@Example.COM ",
        password: "correct-password",
        deviceLabel: "  Chrome on macOS  ",
        client: CLIENT,
      }),
    ).resolves.toEqual({
      accessToken: "access-token",
      tokenType: AUTH_TOKEN_TYPE.BEARER,
      expiresIn: 900,
      refreshToken: `${REFRESH_TOKEN_ID}.refresh-secret`,
      refreshTokenExpiresAt: new Date("2026-09-17T09:00:00.000Z"),
    });

    expect(
      dependencies.iamAuthQuery.findAuthenticationUserByEmail,
    ).toHaveBeenCalledWith("user@example.com");
    expect(dependencies.passwordHasher.verify).toHaveBeenCalledWith(
      "$argon2id$test-hash",
      "correct-password",
    );
    expect(
      dependencies.authSessionRepository.createLoginSession,
    ).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      userId: USER_ID,
      deviceLabel: "Chrome on macOS",
      idleExpiresAt: new Date("2026-09-17T08:10:00.000Z"),
      absoluteExpiresAt: new Date("2026-09-17T09:00:00.000Z"),
      refreshTokenId: REFRESH_TOKEN_ID,
      refreshTokenHash: "a".repeat(64),
      occurredAt: NOW,
      client: CLIENT,
    });
    expect(
      dependencies.authEventRepository.recordLoginFailure,
    ).not.toHaveBeenCalled();
  });

  it("consumes password-hash work and returns the generic error for an unknown email", async () => {
    const dependencies = createService();
    dependencies.iamAuthQuery.findAuthenticationUserByEmail.mockResolvedValue(
      null,
    );

    await expect(
      dependencies.service.execute({
        email: "missing@example.com",
        password: "candidate-password",
        client: CLIENT,
      }),
    ).rejects.toMatchObject({
      name: AppError.name,
      code: APP_ERROR_CODE.AUTH_INVALID_CREDENTIALS,
    });

    expect(
      dependencies.passwordHasher.consumeVerificationCost,
    ).toHaveBeenCalledWith("candidate-password");
    expect(
      dependencies.authEventRepository.recordLoginFailure,
    ).toHaveBeenCalledWith({
      targetUserId: null,
      reason: LOGIN_FAILURE_REASON.UNKNOWN_IDENTITY,
      occurredAt: NOW,
      client: CLIENT,
    });
  });

  it.each([
    {
      name: "incorrect password",
      status: USER_STATUS.ACTIVE,
      passwordMatches: false,
      reason: LOGIN_FAILURE_REASON.INVALID_PASSWORD,
    },
    {
      name: "inactive account",
      status: USER_STATUS.INACTIVE,
      passwordMatches: true,
      reason: LOGIN_FAILURE_REASON.ACCOUNT_NOT_ACTIVE,
    },
    {
      name: "suspended account",
      status: USER_STATUS.SUSPENDED,
      passwordMatches: true,
      reason: LOGIN_FAILURE_REASON.ACCOUNT_NOT_ACTIVE,
    },
  ])("returns the same generic error for $name", async (scenario) => {
    const dependencies = createService();
    dependencies.iamAuthQuery.findAuthenticationUserByEmail.mockResolvedValue(
      authenticationUser(scenario.status),
    );
    dependencies.passwordHasher.verify.mockResolvedValue(
      scenario.passwordMatches,
    );

    await expect(
      dependencies.service.execute({
        email: "user@example.com",
        password: "candidate-password",
        client: CLIENT,
      }),
    ).rejects.toMatchObject({
      name: AppError.name,
      code: APP_ERROR_CODE.AUTH_INVALID_CREDENTIALS,
    });

    expect(
      dependencies.authEventRepository.recordLoginFailure,
    ).toHaveBeenCalledWith({
      targetUserId: USER_ID,
      reason: scenario.reason,
      occurredAt: NOW,
      client: CLIENT,
    });
    expect(
      dependencies.authSessionRepository.createLoginSession,
    ).not.toHaveBeenCalled();
  });

  it("rejects a user disabled while the login transaction is being created", async () => {
    const dependencies = createService();
    dependencies.iamAuthQuery.findAuthenticationUserByEmail.mockResolvedValue(
      authenticationUser(),
    );
    dependencies.passwordHasher.verify.mockResolvedValue(true);
    dependencies.identifierGenerator.generate.mockReturnValue(SESSION_ID);
    dependencies.refreshTokenService.issue.mockReturnValue({
      tokenId: REFRESH_TOKEN_ID,
      rawToken: `${REFRESH_TOKEN_ID}.refresh-secret`,
      tokenHash: "b".repeat(64),
    });
    dependencies.accessTokenService.issue.mockResolvedValue("discarded-token");
    dependencies.authSessionRepository.createLoginSession.mockResolvedValue(
      CREATE_LOGIN_SESSION_RESULT.USER_NOT_ACTIVE,
    );

    await expect(
      dependencies.service.execute({
        email: "user@example.com",
        password: "correct-password",
        client: CLIENT,
      }),
    ).rejects.toMatchObject({
      name: AppError.name,
      code: APP_ERROR_CODE.AUTH_INVALID_CREDENTIALS,
    });

    expect(
      dependencies.authEventRepository.recordLoginFailure,
    ).toHaveBeenCalledWith({
      targetUserId: USER_ID,
      reason: LOGIN_FAILURE_REASON.ACCOUNT_NOT_ACTIVE,
      occurredAt: NOW,
      client: CLIENT,
    });
  });
});
