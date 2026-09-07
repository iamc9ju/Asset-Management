import { randomUUID } from "node:crypto";
import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";
import type { ErrorResponseEnvelope } from "../../errors/error-response.types";
import { REQUEST_ID_HEADER } from "../request-id/request-id.constants";
import type { RequestWithId } from "../request-id/request-id.types";
import { mapHttpException } from "./http-error.mapper";

const HTTP_REQUEST_FAILED_EVENT = "http_request_failed";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? randomUUID();
    const mappedError = mapHttpException(exception);
    const body: ErrorResponseEnvelope = {
      error: {
        code: mappedError.code,
        message: mappedError.message,
        details: mappedError.details,
        request_id: requestId,
      },
    };

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);

    if (mappedError.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify({
          event: HTTP_REQUEST_FAILED_EVENT,
          request_id: requestId,
          method: request.method,
          path: request.originalUrl,
          status_code: mappedError.statusCode,
          error_code: mappedError.code,
          error_type:
            exception instanceof Error ? exception.name : typeof exception,
        }),
      );
    }

    response.status(mappedError.statusCode).json(body);
  }
}
