import type { AppErrorCode } from "./app-error-code";
import type { ErrorDetails } from "./error-details";

export interface ErrorResponseEnvelope {
  error: {
    code: AppErrorCode;
    message: string;
    details: ErrorDetails;
    request_id: string;
  };
}
