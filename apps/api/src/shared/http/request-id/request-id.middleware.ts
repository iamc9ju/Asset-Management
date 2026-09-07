import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { REQUEST_ID_HEADER } from "./request-id.constants";
import type { RequestWithId } from "./request-id.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveRequestId(request: Request): string {
  const candidate = request.get(REQUEST_ID_HEADER)?.trim();

  if (candidate && UUID_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }

  return randomUUID();
}

export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const requestId = resolveRequestId(request);

  (request as RequestWithId).requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}
