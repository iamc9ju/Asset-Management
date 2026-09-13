import type { Response } from "express";
import type { RequestWithId } from "../http/request-id/request-id.types";
import {
  serializeHttpRequest,
  serializeHttpResponse,
} from "./http-log.serializer";

const REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000";

function createRequest(overrides: Partial<RequestWithId> = {}): RequestWithId {
  return {
    requestId: REQUEST_ID,
    method: "GET",
    baseUrl: "",
    originalUrl: "/assets",
    url: "/assets",
    ...overrides,
  } as RequestWithId;
}

describe("HTTP log serializers", () => {
  describe("serializeHttpRequest", () => {
    it("uses the normalized route template for a matched route", () => {
      const request = createRequest({
        baseUrl: "/api/v1",
        route: { path: "/assets/:assetId" },
        originalUrl: "/api/v1/assets/123?access_token=secret",
      });

      expect(serializeHttpRequest(request)).toEqual({
        request_id: REQUEST_ID,
        method: "GET",
        route: "/api/v1/assets/:assetId",
      });
    });

    it("removes the query string from an unmatched route", () => {
      const request = createRequest({
        route: undefined,
        originalUrl: "/api/v1/unknown?access_token=secret",
      });

      expect(serializeHttpRequest(request)).toEqual({
        request_id: REQUEST_ID,
        method: "GET",
        route: "/api/v1/unknown",
      });
    });

    it("returns only allowlisted request fields", () => {
      const request = createRequest({
        headers: {
          authorization: "Bearer secret-token",
          cookie: "session=secret",
        },
        body: {
          password: "secret-password",
        },
      });

      const serialized = serializeHttpRequest(request);

      expect(Object.keys(serialized).sort()).toEqual([
        "method",
        "request_id",
        "route",
      ]);
      expect(JSON.stringify(serialized)).not.toContain("secret");
    });
  });

  describe("serializeHttpResponse", () => {
    it("returns only the response status code", () => {
      const response = {
        statusCode: 201,
        getHeaders: () => ({
          "set-cookie": "session=secret",
        }),
      } as unknown as Response;

      expect(serializeHttpResponse(response)).toEqual({
        status_code: 201,
      });
    });
  });
});
