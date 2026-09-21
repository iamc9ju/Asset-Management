import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { ErrorResponseEnvelopeOpenApi } from "../../../../shared/http/openapi/error-response.openapi";
import { OPENAPI_SECURITY_SCHEME } from "../../../../shared/http/openapi/openapi.constants";
import type { PermissionCode } from "../../../iam/domain/permission-code";
import { AUTH_HTTP_HEADER, AUTH_TOKEN_TYPE } from "../../domain/auth.constants";
import { AccessTokenGuard } from "../guards/access-token.guard";
import { PermissionGuard } from "../guards/permission.guard";
import { REQUIRED_PERMISSIONS_METADATA } from "../required-permissions.metadata";

export function RequirePermissions(
  ...permissionCodes: readonly PermissionCode[]
): MethodDecorator {
  if (permissionCodes.length === 0) {
    throw new TypeError(
      "RequirePermissions needs at least one permission code.",
    );
  }

  const requiredPermissions = Object.freeze([...new Set(permissionCodes)]);

  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_METADATA, requiredPermissions),
    UseGuards(AccessTokenGuard, PermissionGuard),
    ApiBearerAuth(OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN),
    ApiUnauthorizedResponse({
      type: ErrorResponseEnvelopeOpenApi,
      description:
        "The access token is invalid or expired, or its server-side session is unavailable.",
      headers: {
        [AUTH_HTTP_HEADER.WWW_AUTHENTICATE]: {
          description: "Bearer authentication challenge.",
          schema: { type: "string", example: AUTH_TOKEN_TYPE.BEARER },
        },
      },
    }),
    ApiForbiddenResponse({
      type: ErrorResponseEnvelopeOpenApi,
      description:
        "The authenticated user does not have every permission required by this operation.",
    }),
  );
}
