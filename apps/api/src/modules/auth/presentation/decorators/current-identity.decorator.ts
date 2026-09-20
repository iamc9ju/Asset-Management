import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import type { AuthenticatedIdentity } from "../../domain/authenticated-identity";
import type { AuthenticatedRequest } from "../authenticated-request";

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedIdentity => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authenticatedIdentity) {
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_INVALID);
    }

    return request.authenticatedIdentity;
  },
);
