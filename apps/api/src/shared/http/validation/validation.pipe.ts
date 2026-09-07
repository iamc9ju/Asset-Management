import { ValidationPipe } from "@nestjs/common";
import { APP_ERROR_CODE } from "../../errors/app-error-code";
import { AppError } from "../../errors/app-error";
import { mapValidationErrors } from "./validation-error.mapper";

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    stopAtFirstError: false,
    validationError: {
      target: false,
      value: false,
    },
    transformOptions: {
      enableImplicitConversion: false,
    },
    exceptionFactory: (errors) =>
      new AppError(APP_ERROR_CODE.VALIDATION_FAILED, {
        details: mapValidationErrors(errors),
      }),
  });
}
