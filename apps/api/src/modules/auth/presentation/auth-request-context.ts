import { isIP } from "node:net";
import type { RequestWithId } from "../../../shared/http/request-id/request-id.types";
import type { LoginClientContext } from "../application/ports/auth-session-repository.port";
import { AUTH_CLIENT_METADATA_LIMIT } from "../domain/auth.constants";

export function createLoginClientContext(
  request: RequestWithId,
): LoginClientContext {
  return {
    requestId: request.requestId,
    ipAddress: normalizeIpAddress(request.ip),
    userAgent: normalizeUserAgent(request.get("user-agent")),
  };
}

function normalizeIpAddress(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized && isIP(normalized) !== 0 ? normalized : null;
}

function normalizeUserAgent(value: string | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, AUTH_CLIENT_METADATA_LIMIT.USER_AGENT_LENGTH);
}
