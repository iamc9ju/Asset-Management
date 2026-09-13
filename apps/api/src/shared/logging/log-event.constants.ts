export const LOG_EVENTS = {
  APPLICATION_STARTED: "application_started",
  APPLICATION_STOPPING: "application_stopping",
  HTTP_REQUEST_COMPLETED: "http_request_completed",
  HTTP_REQUEST_FAILED: "http_request_failed",
  INFRASTRUCTURE_DEPENDENCY_UNAVAILABLE:
    "infrastructure_dependency_unavailable",
} as const;

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];
