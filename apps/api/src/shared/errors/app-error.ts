import { APP_ERROR_MESSAGE, type AppErrorCode } from "./app-error-code";

export interface AppErrorOptions {
  readonly details?: Readonly<Record<string, unknown>>;
  readonly cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: AppErrorCode, options: AppErrorOptions = {}) {
    super(APP_ERROR_MESSAGE[code], { cause: options.cause });

    this.name = AppError.name;
    this.code = code;
    this.details = options.details;
  }
}
