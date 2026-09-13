import { randomUUID } from "node:crypto";
import {
  ArgumentsHost,
  Catch,
  HttpStatus,
  type ExceptionFilter,
} from "@nestjs/common";
import type { Response } from "express";
import type { ErrorResponseEnvelope } from "../../errors/error-response.types";
import type { RequestWithLoggingContext } from "../../logging/logging.types";
import { REQUEST_ID_HEADER } from "../request-id/request-id.constants";
import { mapHttpException } from "./http-error.mapper";

const UNKNOWN_ERROR_TYPE = "UnknownError";

function resolveErrorType(exception: unknown): string {
  return exception instanceof Error
    ? exception.constructor.name
    : UNKNOWN_ERROR_TYPE;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithLoggingContext>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? randomUUID();
    const mappedError = mapHttpException(exception);

    request.requestId = requestId;
    request.loggingContext = {
      error_code: mappedError.code,
      ...(mappedError.statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
        ? { error_type: resolveErrorType(exception) }
        : {}),
    };

    response.setHeader(REQUEST_ID_HEADER, requestId);

    const body: ErrorResponseEnvelope = {
      error: {
        code: mappedError.code,
        message: mappedError.message,
        details: mappedError.details,
        request_id: requestId,
      },
    };

    response.status(mappedError.statusCode).json(body);
  }
}
