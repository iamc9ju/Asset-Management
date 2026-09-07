import type { NextFunction, Request, Response } from "express";
import { REQUEST_ID_HEADER } from "./request-id.constants";
import { requestIdMiddleware } from "./request-id.middleware";
import type { RequestWithId } from "./request-id.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("requestIdMiddleware", () => {
  function createContext(incomingRequestId?: string) {
    const request = {
      get: jest.fn((header: string) =>
        header === REQUEST_ID_HEADER ? incomingRequestId : undefined,
      ),
    } as unknown as Request;

    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;

    const next = jest.fn() as NextFunction;

    return { request, response, next };
  }

  it("preserves a valid incoming request ID", () => {
    const incomingRequestId = "123e4567-e89b-42d3-a456-426614174000";
    const { request, response, next } = createContext(incomingRequestId);

    requestIdMiddleware(request, response, next);

    expect((request as RequestWithId).requestId).toBe(incomingRequestId);
    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      incomingRequestId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("generates a request ID when the header is missing", () => {
    const { request, response, next } = createContext();

    requestIdMiddleware(request, response, next);

    const requestId = (request as RequestWithId).requestId;

    expect(requestId).toMatch(UUID_PATTERN);
    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      requestId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("replaces an invalid incoming request ID", () => {
    const { request, response, next } = createContext(
      "invalid-request-id\r\ninjected-header",
    );

    requestIdMiddleware(request, response, next);

    const requestId = (request as RequestWithId).requestId;

    expect(requestId).toMatch(UUID_PATTERN);
    expect(requestId).not.toContain("invalid-request-id");
    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      requestId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
