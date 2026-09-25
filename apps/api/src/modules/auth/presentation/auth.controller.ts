import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiServiceUnavailableResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  APP_ERROR_CODE,
  type AppErrorCode,
} from "../../../shared/errors/app-error-code";
import { AppError } from "../../../shared/errors/app-error";
import {
  API_ROUTE,
  API_ROUTE_PARAM,
} from "../../../shared/http/api-route.constants";
import {
  ApiDataResponseDocumentation,
  ApiListResponseDocumentation,
  ApiNoContentResponseDocumentation,
} from "../../../shared/http/openapi/api-response.openapi";
import { ErrorResponseEnvelopeOpenApi } from "../../../shared/http/openapi/error-response.openapi";
import { OPENAPI_SECURITY_SCHEME } from "../../../shared/http/openapi/openapi.constants";
import type { RequestWithId } from "../../../shared/http/request-id/request-id.types";
import {
  createApiDataResponse,
  createApiListResponse,
} from "../../../shared/http/responses/api-response.factory";
import type {
  ApiDataResponse,
  ApiListResponse,
} from "../../../shared/http/responses/api-response.types";
import { ListAuthSessionsService } from "../application/services/list-auth-sessions.service";
import { LoginService } from "../application/services/login.service";
import { LogoutService } from "../application/services/logout.service";
import { RefreshSessionService } from "../application/services/refresh-session.service";
import { RevokeAllAuthSessionsService } from "../application/services/revoke-all-auth-sessions.service";
import { RevokeAuthSessionService } from "../application/services/revoke-auth-session.service";
import type { AuthenticatedIdentity } from "../domain/authenticated-identity";
import { AUTH_HTTP_HEADER, AUTH_TOKEN_TYPE } from "../domain/auth.constants";
import { createAuthClientContext } from "./auth-request-context";
import { AuthCookieService } from "./auth-cookie.service";
import { CurrentIdentity } from "./decorators/current-identity.decorator";
import { LoginRequestDto } from "./dto/login.request";
import { LoginResponseDataDto } from "./dto/login.response";
import { MeResponseDataDto } from "./dto/me.response";
import { SessionOwnerQueryDto } from "./dto/session-owner.query";
import { SessionResponseDataDto } from "./dto/session.response";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { AuthOriginGuard } from "./guards/auth-origin.guard";
import { LogoutOriginGuard } from "./guards/logout-origin.guard";

const REFRESH_CREDENTIAL_ERROR_CODES: ReadonlySet<AppErrorCode> = new Set([
  APP_ERROR_CODE.AUTH_SESSION_INVALID,
  APP_ERROR_CODE.AUTH_SESSION_EXPIRED,
]);

@ApiTags("Authentication")
@ApiProduces("application/json")
@Controller(API_ROUTE.AUTH.BASE)
export class AuthController {
  constructor(
    private readonly loginService: LoginService,
    private readonly refreshSessionService: RefreshSessionService,
    private readonly logoutService: LogoutService,
    private readonly listAuthSessionsService: ListAuthSessionsService,
    private readonly revokeAuthSessionService: RevokeAuthSessionService,
    private readonly revokeAllAuthSessionsService: RevokeAllAuthSessionsService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Post(API_ROUTE.AUTH.LOGIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Authenticate with email and password",
    description:
      "Returns a short-lived access token and sets an HttpOnly refresh-token cookie.",
  })
  @ApiDataResponseDocumentation({
    model: LoginResponseDataDto,
    headers: {
      "Set-Cookie": {
        description: "HttpOnly refresh-token cookie.",
        schema: { type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiUnauthorizedResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description:
      "The email is unknown, the password is incorrect, or the account is not active.",
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description: "The login IP or normalized account limit was exceeded.",
    headers: {
      "Retry-After": {
        description: "Seconds until another authentication attempt is allowed.",
        schema: { type: "integer", minimum: 1 },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description: "The authentication rate-limit dependency is unavailable.",
  })
  @ApiInternalServerErrorResponse({ type: ErrorResponseEnvelopeOpenApi })
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiDataResponse<LoginResponseDataDto>> {
    const result = await this.loginService.execute({
      email: body.email,
      password: body.password,
      deviceLabel: body.device_label,
      client: createAuthClientContext(request),
    });

    this.authCookieService.setRefreshToken(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );

    return createApiDataResponse({
      access_token: result.accessToken,
      token_type: result.tokenType,
      expires_in: result.expiresIn,
    });
  }

  @Post(API_ROUTE.AUTH.REFRESH)
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthOriginGuard)
  @ApiCookieAuth(OPENAPI_SECURITY_SCHEME.REFRESH_TOKEN)
  @ApiHeader({
    name: "Origin",
    required: true,
    description: "Must exactly match the configured trusted Web origin.",
  })
  @ApiOperation({
    summary: "Rotate the refresh token and issue a new access token",
    description:
      "Consumes the HttpOnly refresh-token cookie exactly once and replaces it after a successful transaction.",
  })
  @ApiDataResponseDocumentation({
    model: LoginResponseDataDto,
    headers: {
      "Set-Cookie": {
        description: "Replacement HttpOnly refresh-token cookie.",
        schema: { type: "string" },
      },
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description: "The request Origin is missing or is not trusted.",
  })
  @ApiUnauthorizedResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description:
      "The refresh credential or its server-side session is invalid or expired.",
    headers: {
      "Set-Cookie": {
        description: "Clears the unusable refresh-token cookie.",
        schema: { type: "string" },
      },
    },
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description: "The refresh IP or credential-selector limit was exceeded.",
    headers: {
      "Retry-After": {
        description: "Seconds until another refresh attempt is allowed.",
        schema: { type: "integer", minimum: 1 },
      },
    },
  })
  @ApiServiceUnavailableResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description: "The authentication rate-limit dependency is unavailable.",
  })
  @ApiInternalServerErrorResponse({ type: ErrorResponseEnvelopeOpenApi })
  async refresh(
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiDataResponse<LoginResponseDataDto>> {
    const rawRefreshToken = this.authCookieService.readRefreshToken(request);

    if (!rawRefreshToken) {
      this.authCookieService.clearRefreshToken(response);
      throw new AppError(APP_ERROR_CODE.AUTH_SESSION_INVALID);
    }

    try {
      const result = await this.refreshSessionService.execute({
        rawRefreshToken,
        client: createAuthClientContext(request),
      });

      this.authCookieService.setRefreshToken(
        response,
        result.refreshToken,
        result.refreshTokenExpiresAt,
      );

      return createApiDataResponse({
        access_token: result.accessToken,
        token_type: result.tokenType,
        expires_in: result.expiresIn,
      });
    } catch (error) {
      if (
        error instanceof AppError &&
        REFRESH_CREDENTIAL_ERROR_CODES.has(error.code)
      ) {
        this.authCookieService.clearRefreshToken(response);
      }

      throw error;
    }
  }

  @Post(API_ROUTE.AUTH.LOGOUT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(LogoutOriginGuard)
  @ApiHeader({
    name: "Origin",
    required: false,
    description:
      "Required and must exactly match the trusted Web origin when a refresh cookie is present.",
  })
  @ApiOperation({
    summary: "Log out the current refresh-token session",
    description:
      "Idempotently revokes the session identified by a valid refresh cookie and always clears that cookie. Missing, malformed, unknown, or expired credentials do not reveal session existence.",
  })
  @ApiNoContentResponseDocumentation({
    description: "The refresh-token cookie has been cleared.",
    headers: {
      "Set-Cookie": {
        description: "Clears the refresh-token cookie.",
        schema: { type: "string" },
      },
    },
  })
  @ApiForbiddenResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description:
      "A refresh cookie was supplied but the request Origin is missing or not trusted.",
  })
  @ApiInternalServerErrorResponse({ type: ErrorResponseEnvelopeOpenApi })
  async logout(
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const rawRefreshToken = this.authCookieService.readRefreshToken(request);

    this.authCookieService.clearRefreshToken(response);

    if (!rawRefreshToken) {
      return;
    }

    await this.logoutService.execute({
      rawRefreshToken,
      client: createAuthClientContext(request),
    });
  }

  @Get(API_ROUTE.AUTH.ME)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth(OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN)
  @ApiOperation({
    summary: "Get the current authenticated user",
    description:
      "Requires a valid access token and an active server-side session.",
  })
  @ApiDataResponseDocumentation({ model: MeResponseDataDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseEnvelopeOpenApi,
    description:
      "The access token is invalid or expired, or its server-side session is unavailable.",
    headers: {
      [AUTH_HTTP_HEADER.WWW_AUTHENTICATE]: {
        description: "Bearer authentication challenge.",
        schema: { type: "string", example: AUTH_TOKEN_TYPE.BEARER },
      },
    },
  })
  @ApiInternalServerErrorResponse({ type: ErrorResponseEnvelopeOpenApi })
  me(
    @CurrentIdentity() identity: AuthenticatedIdentity,
  ): ApiDataResponse<MeResponseDataDto> {
    return createApiDataResponse({
      user_id: identity.userId,
      display_name: identity.displayName,
      status: identity.status,
      permissions: [...identity.permissionCodes],
    });
  }

  @Get(API_ROUTE.AUTH.SESSIONS)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth(OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN)
  @ApiOperation({
    summary: "List active authentication sessions",
    description:
      "Lists the authenticated user's active sessions. Supplying another user_id requires session:read:any.",
  })
  @ApiListResponseDocumentation({ model: SessionResponseDataDto })
  @ApiBadRequestResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiUnauthorizedResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiForbiddenResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiInternalServerErrorResponse({ type: ErrorResponseEnvelopeOpenApi })
  async listSessions(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Query() query: SessionOwnerQueryDto,
  ): Promise<ApiListResponse<SessionResponseDataDto>> {
    const sessions = await this.listAuthSessionsService.execute({
      identity,
      targetUserId: query.user_id,
    });

    return createApiListResponse(
      sessions.map((session) => ({
        session_id: session.sessionId,
        user_id: session.userId,
        device_label: session.deviceLabel,
        created_at: session.createdAt.toISOString(),
        last_used_at: session.lastUsedAt?.toISOString() ?? null,
        idle_expires_at: session.idleExpiresAt.toISOString(),
        expires_at: session.absoluteExpiresAt.toISOString(),
        is_current: session.isCurrent,
      })),
    );
  }

  @Delete(API_ROUTE.AUTH.SESSION_BY_ID)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth(OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN)
  @ApiParam({
    name: API_ROUTE_PARAM.AUTH_SESSION_ID,
    format: "uuid",
    description: "Authentication session to revoke.",
  })
  @ApiOperation({
    summary: "Revoke one authentication session",
    description:
      "A user may revoke an owned session. Revoking another user's session requires session:revoke:any.",
  })
  @ApiNoContentResponseDocumentation({
    description: "The session is revoked or was already revoked.",
    headers: {
      "Set-Cookie": {
        description:
          "Clears the refresh-token cookie when the current session is revoked.",
        schema: { type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiUnauthorizedResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiForbiddenResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiNotFoundResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiInternalServerErrorResponse({ type: ErrorResponseEnvelopeOpenApi })
  async revokeSession(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Param(API_ROUTE_PARAM.AUTH_SESSION_ID, new ParseUUIDPipe())
    sessionId: string,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const result = await this.revokeAuthSessionService.execute({
      identity,
      sessionId,
      client: createAuthClientContext(request),
    });

    if (result.revokedCurrentSession) {
      this.authCookieService.clearRefreshToken(response);
    }
  }

  @Delete(API_ROUTE.AUTH.SESSIONS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AccessTokenGuard)
  @ApiBearerAuth(OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN)
  @ApiOperation({
    summary: "Revoke all authentication sessions for a user",
    description:
      "Revokes every session, including the current session, for the authenticated user. Supplying another user_id requires session:revoke:any.",
  })
  @ApiNoContentResponseDocumentation({
    description: "All matching sessions are revoked.",
    headers: {
      "Set-Cookie": {
        description:
          "Clears the refresh-token cookie when revoking the authenticated user's sessions.",
        schema: { type: "string" },
      },
    },
  })
  @ApiBadRequestResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiUnauthorizedResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiForbiddenResponse({ type: ErrorResponseEnvelopeOpenApi })
  @ApiInternalServerErrorResponse({ type: ErrorResponseEnvelopeOpenApi })
  async revokeAllSessions(
    @CurrentIdentity() identity: AuthenticatedIdentity,
    @Query() query: SessionOwnerQueryDto,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const result = await this.revokeAllAuthSessionsService.execute({
      identity,
      targetUserId: query.user_id,
      client: createAuthClientContext(request),
    });

    if (result.revokedCurrentSession) {
      this.authCookieService.clearRefreshToken(response);
    }
  }
}
