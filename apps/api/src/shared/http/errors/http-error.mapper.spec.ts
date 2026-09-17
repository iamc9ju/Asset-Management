import { HttpStatus } from "@nestjs/common";
import {
  APP_ERROR_CODE,
  APP_ERROR_MESSAGE,
} from "../../errors/app-error-code";
import { AppError } from "../../errors/app-error";
import { mapHttpException } from "./http-error.mapper";

describe("mapHttpException authentication errors", () => {
  it.each([
    [APP_ERROR_CODE.AUTH_INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED],
    [APP_ERROR_CODE.AUTH_ACCESS_TOKEN_INVALID, HttpStatus.UNAUTHORIZED],
    [APP_ERROR_CODE.AUTH_ACCESS_TOKEN_EXPIRED, HttpStatus.UNAUTHORIZED],
    [APP_ERROR_CODE.AUTH_SESSION_INVALID, HttpStatus.UNAUTHORIZED],
    [APP_ERROR_CODE.AUTH_SESSION_EXPIRED, HttpStatus.UNAUTHORIZED],
    [APP_ERROR_CODE.AUTH_PERMISSION_DENIED, HttpStatus.FORBIDDEN],
    [APP_ERROR_CODE.AUTH_RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS],
  ] as const)("maps %s to HTTP %s", (code, statusCode) => {
    expect(mapHttpException(new AppError(code))).toEqual({
      statusCode,
      code,
      message: APP_ERROR_MESSAGE[code],
      details: {},
    });
  });
});
