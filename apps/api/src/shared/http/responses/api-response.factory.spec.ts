import {
  createApiDataResponse,
  createApiListResponse,
  createApiPaginatedResponse,
} from "./api-response.factory";

describe("API response factory", () => {
  it("wraps a single resource in the standard data envelope", () => {
    const resource = { id: "resource-id", name: "Example" };

    expect(createApiDataResponse(resource)).toEqual({ data: resource });
  });

  it("copies a collection into the standard list envelope", () => {
    const source = [{ id: "first" }];
    const response = createApiListResponse(source);

    source.push({ id: "second" });

    expect(response).toEqual({ data: [{ id: "first" }] });
  });

  it("computes deterministic pagination metadata", () => {
    expect(
      createApiPaginatedResponse([{ id: "first" }, { id: "second" }], {
        page: 2,
        limit: 2,
        total: 5,
      }),
    ).toEqual({
      data: [{ id: "first" }, { id: "second" }],
      meta: {
        page: 2,
        limit: 2,
        total: 5,
        total_pages: 3,
      },
    });
  });

  it("returns zero total pages for an empty result set", () => {
    expect(
      createApiPaginatedResponse([], { page: 1, limit: 20, total: 0 }),
    ).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });
  });

  it.each([
    { page: 0, limit: 20, total: 1 },
    { page: 1.5, limit: 20, total: 1 },
    { page: 1, limit: 0, total: 1 },
    { page: 1, limit: 20, total: -1 },
    { page: 1, limit: 20, total: Number.MAX_SAFE_INTEGER + 1 },
  ])("rejects invalid pagination input: %o", (pagination) => {
    expect(() => createApiPaginatedResponse([], pagination)).toThrow(
      RangeError,
    );
  });

  it("rejects a page containing more items than its declared limit", () => {
    expect(() =>
      createApiPaginatedResponse([{ id: "first" }, { id: "second" }], {
        page: 1,
        limit: 1,
        total: 2,
      }),
    ).toThrow("cannot contain more items than the requested limit");
  });

  it("rejects a page containing more items than the total result count", () => {
    expect(() =>
      createApiPaginatedResponse([{ id: "first" }], {
        page: 1,
        limit: 20,
        total: 0,
      }),
    ).toThrow("cannot contain more items than the total result count");
  });
});
