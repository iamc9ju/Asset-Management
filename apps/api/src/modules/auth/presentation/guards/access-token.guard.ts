import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import type { Response } from "express";
import {
  APP_ERROR_CODE,
  type AppErrorCode,
} from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import { AuthenticateAccessTokenService } from "../../application/services/authenticate-access-token.service";
import { AUTH_HTTP_HEADER, AUTH_TOKEN_TYPE } from "../../domain/auth.constants";
import type { AuthenticatedRequest } from "../authenticated-request";

const ACCESS_AUTHENTICATION_ERROR_CODES: ReadonlySet<AppErrorCode> =
  new Set<AppErrorCode>([
    APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID,
    APP_ERROR_CODE.AUTH_ACCESS_TOKEN_EXPIRED,
    APP_ERROR_CODE.AUTH_SESSION_INVALID,
    APP_ERROR_CODE.AUTH_SESSION_EXPIRED,
  ]);

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly authenticateAccessTokenService: AuthenticateAccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<AuthenticatedRequest>();
    const response = httpContext.getResponse<Response>();

    try {
      const accessToken = extractBearerAccessToken(
        request.get(AUTH_HTTP_HEADER.AUTHORIZATION),
      );
      request.authenticatedIdentity =
        await this.authenticateAccessTokenService.execute(accessToken);

      return true;
    } catch (error) {
      if (
        error instanceof AppError &&
        ACCESS_AUTHENTICATION_ERROR_CODES.has(error.code)
      ) {
        response.setHeader(
          AUTH_HTTP_HEADER.WWW_AUTHENTICATE,
          AUTH_TOKEN_TYPE.BEARER,
        );
      }

      throw error;
    }
  }
}

export function extractBearerAccessToken(
  authorizationHeader: string | undefined,
): string {
  const match = authorizationHeader?.trim().match(/^Bearer[\t ]+([^\s]+)$/i);

  if (!match?.[1]) {
    throw new AppError(APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID);
  }

  return match[1];
}
