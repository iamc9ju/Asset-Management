export interface ApiDataResponse<T extends object> {
  readonly data: T;
}

export interface ApiListResponse<T extends object> {
  readonly data: readonly T[];
}

export interface ApiPaginationMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly total_pages: number;
}

export interface ApiPaginatedResponse<T extends object> {
  readonly data: readonly T[];
  readonly meta: ApiPaginationMeta;
}

export interface ApiPaginationInput {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
}
