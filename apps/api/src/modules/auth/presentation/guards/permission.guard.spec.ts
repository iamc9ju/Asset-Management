import type { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  APP_ERROR_CODE,
  type AppErrorCode,
} from "../../../../shared/errors/app-error-code";
import {
  PERMISSION_CODE,
  type PermissionCode,
} from "../../../iam/domain/permission-code";
import { USER_STATUS } from "../../../iam/domain/user-status";
import type { AuthenticatedIdentity } from "../../domain/authenticated-identity";
import type { AuthenticatedRequest } from "../authenticated-request";
import { REQUIRED_PERMISSIONS_METADATA } from "../required-permissions.metadata";
import { PermissionGuard } from "./permission.guard";
import type { AuthEventRepository } from "../../application/ports/auth-event.port";
import { AUTHORIZATION_DENIAL_REASON } from "../../application/ports/auth-event.port";
import type { Clock } from "../../application/ports/clock.port";

const AUTHENTICATED_IDENTITY: AuthenticatedIdentity = {
  userId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  displayName: "Test User",
  status: USER_STATUS.ACTIVE,
  permissionVersion: "1",
  permissionCodes: [PERMISSION_CODE.ASSET_READ, PERMISSION_CODE.ASSET_UPDATE],
};
const NOW = new Date("2026-09-25T09:00:00.000Z");
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";

function permissionProtectedHandler(): void {}

async function expectAppErrorCode(
  operation: () => Promise<unknown>,
  code: AppErrorCode,
): Promise<void> {
  try {
    await operation();
    throw new Error(`Expected ${code} to be thrown`);
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

function createContext(
  options: {
    readonly identity?: AuthenticatedIdentity;
    readonly requiredPermissions?: readonly PermissionCode[];
  } = {},
): ExecutionContext {
  if (options.requiredPermissions) {
    Reflect.defineMetadata(
      REQUIRED_PERMISSIONS_METADATA,
      options.requiredPermissions,
      permissionProtectedHandler,
    );
  } else {
    Reflect.deleteMetadata(
      REQUIRED_PERMISSIONS_METADATA,
      permissionProtectedHandler,
    );
  }

  const request = {
    authenticatedIdentity: options.identity,
    requestId: REQUEST_ID,
    ip: "127.0.0.1",
    get: jest.fn().mockReturnValue("Permission guard test"),
  } as unknown as AuthenticatedRequest;

  return {
    getHandler: () => permissionProtectedHandler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("PermissionGuard", () => {
  const authEventRepository: jest.Mocked<AuthEventRepository> = {
    recordLoginFailure: jest.fn(),
    recordRateLimitExceeded: jest.fn(),
    recordAuthorizationDenied: jest.fn(),
    recordRetentionCleanupCompleted: jest.fn(),
  };
  const clock: Clock = { now: () => new Date(NOW) };
  const guard = new PermissionGuard(
    new Reflector(),
    authEventRepository,
    clock,
  );

  beforeEach(() => {
    authEventRepository.recordAuthorizationDenied.mockReset();
  });

  it("allows an identity that has every required permission", async () => {
    const context = createContext({
      identity: AUTHENTICATED_IDENTITY,
      requiredPermissions: [
        PERMISSION_CODE.ASSET_READ,
        PERMISSION_CODE.ASSET_UPDATE,
      ],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(
      authEventRepository.recordAuthorizationDenied,
    ).not.toHaveBeenCalled();
  });

  it("denies an identity that is missing any required permission", async () => {
    const context = createContext({
      identity: AUTHENTICATED_IDENTITY,
      requiredPermissions: [
        PERMISSION_CODE.ASSET_READ,
        PERMISSION_CODE.ASSET_TRANSFER,
      ],
    });

    await expectAppErrorCode(
      () => guard.canActivate(context),
      APP_ERROR_CODE.AUTH_PERMISSION_DENIED,
    );
    expect(authEventRepository.recordAuthorizationDenied).toHaveBeenCalledWith(
      {
        actorUserId: AUTHENTICATED_IDENTITY.userId,
        sessionId: AUTHENTICATED_IDENTITY.sessionId,
        requiredPermissions: [
          PERMISSION_CODE.ASSET_READ,
          PERMISSION_CODE.ASSET_TRANSFER,
        ],
        reason: AUTHORIZATION_DENIAL_REASON.MISSING_REQUIRED_PERMISSION,
        occurredAt: NOW,
        client: {
          requestId: REQUEST_ID,
          ipAddress: "127.0.0.1",
          userAgent: "Permission guard test",
        },
      },
    );
  });

  it("returns an authentication error when the access-token guard did not attach an identity", async () => {
    const context = createContext({
      requiredPermissions: [PERMISSION_CODE.ASSET_READ],
    });

    await expectAppErrorCode(
      () => guard.canActivate(context),
      APP_ERROR_CODE.AUTH_SESSION_INVALID,
    );
    expect(
      authEventRepository.recordAuthorizationDenied,
    ).not.toHaveBeenCalled();
  });

  it("fails closed when the guard is used without permission metadata", async () => {
    const context = createContext({ identity: AUTHENTICATED_IDENTITY });

    await expectAppErrorCode(
      () => guard.canActivate(context),
      APP_ERROR_CODE.AUTH_PERMISSION_DENIED,
    );
    expect(authEventRepository.recordAuthorizationDenied).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredPermissions: [],
        reason: AUTHORIZATION_DENIAL_REASON.MISSING_PERMISSION_METADATA,
      }),
    );
  });
});
