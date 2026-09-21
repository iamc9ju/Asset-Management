import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import type { PermissionCode } from "../../../iam/domain/permission-code";
import type { AuthenticatedRequest } from "../authenticated-request";
import { REQUIRED_PERMISSIONS_METADATA } from "../required-permissions.metadata";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<
      readonly PermissionCode[] | undefined
    >(REQUIRED_PERMISSIONS_METADATA, context.getHandler());

    if (!requiredPermissions?.length) {
      throw new AppError(APP_ERROR_CODE.AUTH_PERMISSION_DENIED);
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const identity = request.authenticatedIdentity;

    if (!identity) {
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_INVALID);
    }

    const grantedPermissions = new Set(identity.permissionCodes);
    const hasEveryRequiredPermission = requiredPermissions.every((permission) =>
      grantedPermissions.has(permission),
    );

    if (!hasEveryRequiredPermission) {
      throw new AppError(APP_ERROR_CODE.AUTH_PERMISSION_DENIED);
    }

    return true;
  }
}
