import { HttpException, HttpStatus } from "@nestjs/common";
import {
  APP_ERROR_CODE,
  APP_ERROR_MESSAGE,
  type AppErrorCode,
} from "../../errors/app-error-code";
import { AppError } from "../../errors/app-error";
import {
  sanitizeErrorDetails,
  type ErrorDetails,
} from "../../errors/error-details";

interface MappedHttpError {
  readonly statusCode: number;
  readonly code: AppErrorCode;
  readonly message: string;
  readonly details: ErrorDetails;
}

const APP_ERROR_HTTP_STATUS = {
  [APP_ERROR_CODE.VALIDATION_FAILED]: HttpStatus.BAD_REQUEST,
  [APP_ERROR_CODE.BAD_REQUEST]: HttpStatus.BAD_REQUEST,
  [APP_ERROR_CODE.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [APP_ERROR_CODE.FORBIDDEN]: HttpStatus.FORBIDDEN,
  [APP_ERROR_CODE.RESOURCE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [APP_ERROR_CODE.CONFLICT]: HttpStatus.CONFLICT,
  [APP_ERROR_CODE.UNPROCESSABLE_ENTITY]: HttpStatus.UNPROCESSABLE_ENTITY,
  [APP_ERROR_CODE.TOO_MANY_REQUESTS]: HttpStatus.TOO_MANY_REQUESTS,
  [APP_ERROR_CODE.SERVICE_UNAVAILABLE]: HttpStatus.SERVICE_UNAVAILABLE,
  [APP_ERROR_CODE.REQUEST_FAILED]: HttpStatus.BAD_REQUEST,
  [APP_ERROR_CODE.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
} as const satisfies Record<AppErrorCode, number>;

const HTTP_STATUS_ERROR_CODE: Readonly<Partial<Record<number, AppErrorCode>>> =
  {
    [HttpStatus.BAD_REQUEST]: APP_ERROR_CODE.BAD_REQUEST,
    [HttpStatus.UNAUTHORIZED]: APP_ERROR_CODE.UNAUTHORIZED,
    [HttpStatus.FORBIDDEN]: APP_ERROR_CODE.FORBIDDEN,
    [HttpStatus.NOT_FOUND]: APP_ERROR_CODE.RESOURCE_NOT_FOUND,
    [HttpStatus.CONFLICT]: APP_ERROR_CODE.CONFLICT,
    [HttpStatus.UNPROCESSABLE_ENTITY]: APP_ERROR_CODE.UNPROCESSABLE_ENTITY,
    [HttpStatus.TOO_MANY_REQUESTS]: APP_ERROR_CODE.TOO_MANY_REQUESTS,
    [HttpStatus.SERVICE_UNAVAILABLE]: APP_ERROR_CODE.SERVICE_UNAVAILABLE,
  };

export function mapHttpException(exception: unknown): MappedHttpError {
  if (exception instanceof AppError) {
    return {
      statusCode: APP_ERROR_HTTP_STATUS[exception.code],
      code: exception.code,
      message: APP_ERROR_MESSAGE[exception.code],
      details: sanitizeErrorDetails(exception.details),
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const code =
        HTTP_STATUS_ERROR_CODE[statusCode] ?? APP_ERROR_CODE.INTERNAL_ERROR;

      return {
        statusCode:
          code === APP_ERROR_CODE.INTERNAL_ERROR
            ? HttpStatus.INTERNAL_SERVER_ERROR
            : statusCode,
        code,
        message: APP_ERROR_MESSAGE[code],
        details: {},
      };
    }

    const code =
      HTTP_STATUS_ERROR_CODE[statusCode] ?? APP_ERROR_CODE.REQUEST_FAILED;

    return {
      statusCode,
      code,
      message: APP_ERROR_MESSAGE[code],
      details: {},
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: APP_ERROR_CODE.INTERNAL_ERROR,
    message: APP_ERROR_MESSAGE[APP_ERROR_CODE.INTERNAL_ERROR],
    details: {},
  };
}
