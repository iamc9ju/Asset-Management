import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { APP_ERROR_CODE } from "../../../../shared/errors/app-error-code";
import { AppError } from "../../../../shared/errors/app-error";
import type { RequestWithId } from "../../../../shared/http/request-id/request-id.types";
import { AUTH_HTTP_HEADER } from "../../domain/auth.constants";

@Injectable()
export class AuthOriginGuard implements CanActivate {
  private readonly trustedOrigin: string;

  constructor(configService: ConfigService) {
    this.trustedOrigin = configService.getOrThrow<string>("WEB_ORIGIN");
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithId>();
    const origin = request.get(AUTH_HTTP_HEADER.ORIGIN)?.trim();

    if (!origin || origin !== this.trustedOrigin) {
      throw new AppError(APP_ERROR_CODE.FORBIDDEN);
    }

    return true;
  }
}
