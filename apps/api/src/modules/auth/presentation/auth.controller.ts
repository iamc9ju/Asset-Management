import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Response } from "express";
import { API_ROUTE } from "../../../shared/http/api-route.constants";
import { ApiDataResponseDocumentation } from "../../../shared/http/openapi/api-response.openapi";
import { ErrorResponseEnvelopeOpenApi } from "../../../shared/http/openapi/error-response.openapi";
import type { RequestWithId } from "../../../shared/http/request-id/request-id.types";
import { createApiDataResponse } from "../../../shared/http/responses/api-response.factory";
import type { ApiDataResponse } from "../../../shared/http/responses/api-response.types";
import { LoginService } from "../application/services/login.service";
import { createLoginClientContext } from "./auth-request-context";
import { AuthCookieService } from "./auth-cookie.service";
import { LoginRequestDto } from "./dto/login.request";
import { LoginResponseDataDto } from "./dto/login.response";

@ApiTags("Authentication")
@ApiProduces("application/json")
@Controller(API_ROUTE.AUTH.BASE)
export class AuthController {
  constructor(
    private readonly loginService: LoginService,
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
      client: createLoginClientContext(request),
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
}
