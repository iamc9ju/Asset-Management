import type { AppErrorCode } from "../errors/app-error-code";
import { LOG_EVENTS } from "./log-event.constants";
import type { RequestWithId } from "../http/request-id/request-id.types";

export interface ApplicationStartedLogFields {
  readonly event: typeof LOG_EVENTS.APPLICATION_STARTED;
  readonly port: number;
}

export interface ApplicationStoppingLogFields {
  readonly event: typeof LOG_EVENTS.APPLICATION_STOPPING;
  readonly signal?: string;
}

export interface HttpRequestLogContext {
  readonly request_id: string;
  readonly method: string;
  readonly route: string;
  readonly status_code: number;
  readonly duration_ms: number;
  readonly actor_id?: string;
}

export interface HttpRequestCompletedLogFields extends HttpRequestLogContext {
  readonly event: typeof LOG_EVENTS.HTTP_REQUEST_COMPLETED;
}

export interface HttpRequestFailedLogFields extends HttpRequestLogContext {
  readonly event: typeof LOG_EVENTS.HTTP_REQUEST_FAILED;
  readonly error_code: AppErrorCode;
  readonly error_type?: string;
}

export type HttpTerminalLogFields =
  HttpRequestCompletedLogFields | HttpRequestFailedLogFields;

export interface RequestErrorLogContext {
  readonly error_code: AppErrorCode;
  readonly error_type?: string;
}

export interface RequestWithLoggingContext extends RequestWithId {
  loggingContext?: RequestErrorLogContext;
}
