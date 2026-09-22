import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import {
  APP_ERROR_CODE,
  type AppErrorCode,
} from "../../../shared/errors/app-error-code";
import { AppError } from "../../../shared/errors/app-error";
import { API_ROUTE } from "../../../shared/http/api-route.constants";
import { ApiDataResponseDocumentation } from "../../../shared/http/openapi/api-response.openapi";
import { ErrorResponseEnvelopeOpenApi } from "../../../shared/http/openapi/error-response.openapi";
import { OPENAPI_SECURITY_SCHEME } from "../../../shared/http/openapi/openapi.constants";
import type { RequestWithId } from "../../../shared/http/request-id/request-id.types";
import { createApiDataResponse } from "../../../shared/http/responses/api-response.factory";
import type { ApiDataResponse } from "../../../shared/http/responses/api-response.types";
import { LoginService } from "../application/services/login.service";
import { RefreshSessionService } from "../application/services/refresh-session.service";
import type { AuthenticatedIdentity } from "../domain/authenticated-identity";
import { AUTH_HTTP_HEADER, AUTH_TOKEN_TYPE } from "../domain/auth.constants";
import { createAuthClientContext } from "./auth-request-context";
import { AuthCookieService } from "./auth-cookie.service";
import { CurrentIdentity } from "./decorators/current-identity.decorator";
import { LoginRequestDto } from "./dto/login.request";
import { LoginResponseDataDto } from "./dto/login.response";
import { MeResponseDataDto } from "./dto/me.response";
import { AccessTokenGuard } from "./guards/access-token.guard";
import { AuthOriginGuard } from "./guards/auth-origin.guard";

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
}
