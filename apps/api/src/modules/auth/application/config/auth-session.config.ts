import type { SessionTtlPolicy } from "../../domain/session-policy";

export interface AuthSessionConfig extends SessionTtlPolicy {
  readonly refreshCookieSecure: boolean;
}

export const AUTH_SESSION_CONFIG = Symbol("AUTH_SESSION_CONFIG");
