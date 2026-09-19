import type {
  ApiDataResponse,
  ApiListResponse,
  ApiPaginatedResponse,
  ApiPaginationInput,
  ApiPaginationMeta,
} from "./api-response.types";

const PAGINATION_BOUNDARY = {
  FIRST_PAGE: 1,
  MINIMUM_LIMIT: 1,
  MINIMUM_TOTAL: 0,
} as const;

export function createApiDataResponse<T extends object>(
  data: T,
): ApiDataResponse<T> {
  return { data };
}

export function createApiListResponse<T extends object>(
  data: readonly T[],
): ApiListResponse<T> {
  return { data: [...data] };
}

export function createApiPaginatedResponse<T extends object>(
  data: readonly T[],
  pagination: ApiPaginationInput,
): ApiPaginatedResponse<T> {
  assertPaginationInput(pagination);

  if (data.length > pagination.limit) {
    throw new RangeError(
      "Paginated response data cannot contain more items than the requested limit.",
    );
  }

  if (data.length > pagination.total) {
    throw new RangeError(
      "Paginated response data cannot contain more items than the total result count.",
    );
  }

  return {
    data: [...data],
    meta: createPaginationMeta(pagination),
  };
}

function createPaginationMeta(
  pagination: ApiPaginationInput,
): ApiPaginationMeta {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total: pagination.total,
    total_pages: Math.ceil(pagination.total / pagination.limit),
  };
}

function assertPaginationInput(pagination: ApiPaginationInput): void {
  assertSafeIntegerAtLeast(
    "page",
    pagination.page,
    PAGINATION_BOUNDARY.FIRST_PAGE,
  );
  assertSafeIntegerAtLeast(
    "limit",
    pagination.limit,
    PAGINATION_BOUNDARY.MINIMUM_LIMIT,
  );
  assertSafeIntegerAtLeast(
    "total",
    pagination.total,
    PAGINATION_BOUNDARY.MINIMUM_TOTAL,
  );
}

function assertSafeIntegerAtLeast(
  field: keyof ApiPaginationInput,
  value: number,
  minimum: number,
): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(
      `Pagination ${field} must be a safe integer greater than or equal to ${minimum}.`,
    );
  }
}
