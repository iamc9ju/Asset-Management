import type { Response } from "express";
import type { RequestWithId } from "../http/request-id/request-id.types";

const NEST_WILDCARD_ROUTE_PATTERN = /\{\/?\*[^}]+\}/;

// Log เเค่เท่าที่ต้องการจะ Log
export interface SerializedHttpRequest {
  readonly request_id: string;
  readonly method: string;
  readonly route: string;
}

export interface SerializedHttpResponse {
  readonly status_code: number;
}

// Function สำหรับการ เคลีย query string ออก
function removeQueryString(url: string): string {
  const queryStart = url.indexOf("?");
  const pathname = queryStart >= 0 ? url.slice(0, queryStart) : url;

  return pathname || "/";
}

function resolveNormalizedRoute(request: RequestWithId): string {
  const routePath: unknown = request.route?.path;

  if (
    typeof routePath === "string" &&
    !NEST_WILDCARD_ROUTE_PATTERN.test(routePath)
  ) {
    const baseUrl = request.baseUrl.endsWith("/")
      ? request.baseUrl.slice(0, -1)
      : request.baseUrl;

    const path = routePath.startsWith("/") ? routePath : `/${routePath}`;

    return `${baseUrl}${path}` || "/";
  }

  return removeQueryString(request.originalUrl || request.url || "/");
}

export function serializeHttpRequest(
  request: RequestWithId,
): SerializedHttpRequest {
  return {
    request_id: request.requestId,
    method: request.method,
    route: resolveNormalizedRoute(request),
  };
}

export function serializeHttpResponse(
  response: Response,
): SerializedHttpResponse {
  return {
    status_code: response.statusCode,
  };
}

export function isUnknownHttpRoute(request: RequestWithId): boolean {
  const routePath: unknown = request.route?.path;

  return (
    typeof routePath !== "string" || NEST_WILDCARD_ROUTE_PATTERN.test(routePath)
  );
}
