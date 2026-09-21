import {
  PERMISSION_CODE,
  type PermissionCode,
} from "../../../iam/domain/permission-code";
import { REQUIRED_PERMISSIONS_METADATA } from "../required-permissions.metadata";
import { RequirePermissions } from "./require-permissions.decorator";

class DecoratorTestController {
  protectedOperation(): void {}
}

function applyPermissionDecorator(...permissionCodes: PermissionCode[]): void {
  const descriptor = Object.getOwnPropertyDescriptor(
    DecoratorTestController.prototype,
    "protectedOperation",
  );

  if (!descriptor) {
    throw new Error("Expected the protected operation descriptor to exist.");
  }

  RequirePermissions(...permissionCodes)(
    DecoratorTestController.prototype,
    "protectedOperation",
    descriptor,
  );
}

describe("RequirePermissions", () => {
  afterEach(() => {
    Reflect.deleteMetadata(
      REQUIRED_PERMISSIONS_METADATA,
      DecoratorTestController.prototype.protectedOperation,
    );
  });

  it("stores a deduplicated immutable permission requirement", () => {
    applyPermissionDecorator(
      PERMISSION_CODE.ASSET_READ,
      PERMISSION_CODE.ASSET_READ,
      PERMISSION_CODE.ASSET_UPDATE,
    );

    const requiredPermissions = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_METADATA,
      DecoratorTestController.prototype.protectedOperation,
    ) as readonly PermissionCode[];

    expect(requiredPermissions).toEqual([
      PERMISSION_CODE.ASSET_READ,
      PERMISSION_CODE.ASSET_UPDATE,
    ]);
    expect(Object.isFrozen(requiredPermissions)).toBe(true);
  });

  it("rejects a protected operation without a permission requirement", () => {
    expect(() => RequirePermissions()).toThrow(TypeError);
  });
});
