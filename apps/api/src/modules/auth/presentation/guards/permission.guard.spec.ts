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

const AUTHENTICATED_IDENTITY: AuthenticatedIdentity = {
  userId: "11111111-1111-4111-8111-111111111111",
  sessionId: "22222222-2222-4222-8222-222222222222",
  displayName: "Test User",
  status: USER_STATUS.ACTIVE,
  permissionVersion: "1",
  permissionCodes: [PERMISSION_CODE.ASSET_READ, PERMISSION_CODE.ASSET_UPDATE],
};

function permissionProtectedHandler(): void {}

function expectAppErrorCode(
  operation: () => unknown,
  code: AppErrorCode,
): void {
  try {
    operation();
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
  } as AuthenticatedRequest;

  return {
    getHandler: () => permissionProtectedHandler,
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe("PermissionGuard", () => {
  const guard = new PermissionGuard(new Reflector());

  it("allows an identity that has every required permission", () => {
    const context = createContext({
      identity: AUTHENTICATED_IDENTITY,
      requiredPermissions: [
        PERMISSION_CODE.ASSET_READ,
        PERMISSION_CODE.ASSET_UPDATE,
      ],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it("denies an identity that is missing any required permission", () => {
    const context = createContext({
      identity: AUTHENTICATED_IDENTITY,
      requiredPermissions: [
        PERMISSION_CODE.ASSET_READ,
        PERMISSION_CODE.ASSET_TRANSFER,
      ],
    });

    expectAppErrorCode(
      () => guard.canActivate(context),
      APP_ERROR_CODE.AUTH_PERMISSION_DENIED,
    );
  });

  it("returns an authentication error when the access-token guard did not attach an identity", () => {
    const context = createContext({
      requiredPermissions: [PERMISSION_CODE.ASSET_READ],
    });

    expectAppErrorCode(
      () => guard.canActivate(context),
      APP_ERROR_CODE.AUTH_SESSION_INVALID,
    );
  });

  it("fails closed when the guard is used without permission metadata", () => {
    const context = createContext({ identity: AUTHENTICATED_IDENTITY });

    expectAppErrorCode(
      () => guard.canActivate(context),
      APP_ERROR_CODE.AUTH_PERMISSION_DENIED,
    );
  });
});
