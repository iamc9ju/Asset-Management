import { applyDecorators, HttpStatus, type Type } from "@nestjs/common";
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
  type HeadersObject,
  type SchemaObject,
} from "@nestjs/swagger";
import { REQUEST_ID_HEADER } from "../request-id/request-id.constants";

type ApiDocumentedStatus = number | "default" | "1XX" | "2XX" | "3XX";

interface ApiEnvelopeDocumentationOptions {
  readonly model: Type<unknown>;
  readonly status?: ApiDocumentedStatus;
  readonly description?: string;
  readonly headers?: HeadersObject;
}

interface ApiNoContentDocumentationOptions {
  readonly description?: string;
  readonly headers?: HeadersObject;
}

export class ApiPaginationMetaOpenApi {
  @ApiProperty({ minimum: 1, example: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, example: 20 })
  limit!: number;

  @ApiProperty({ minimum: 0, example: 1520 })
  total!: number;

  @ApiProperty({ minimum: 0, example: 76 })
  total_pages!: number;
}

export function ApiDataResponseDocumentation(
  options: ApiEnvelopeDocumentationOptions,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(options.model),
    ApiResponse({
      status: options.status ?? HttpStatus.OK,
      description: options.description,
      headers: createResponseHeaders(options.headers),
      schema: createDataEnvelopeSchema(options.model),
    }),
  );
}

export function ApiListResponseDocumentation(
  options: ApiEnvelopeDocumentationOptions,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(options.model),
    ApiResponse({
      status: options.status ?? HttpStatus.OK,
      description: options.description,
      headers: createResponseHeaders(options.headers),
      schema: createListEnvelopeSchema(options.model),
    }),
  );
}

export function ApiPaginatedResponseDocumentation(
  options: ApiEnvelopeDocumentationOptions,
): MethodDecorator {
  return applyDecorators(
    ApiExtraModels(options.model, ApiPaginationMetaOpenApi),
    ApiResponse({
      status: options.status ?? HttpStatus.OK,
      description: options.description,
      headers: createResponseHeaders(options.headers),
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["data", "meta"],
        properties: {
          data: createArraySchema(options.model),
          meta: { $ref: getSchemaPath(ApiPaginationMetaOpenApi) },
        },
      },
    }),
  );
}

export function ApiNoContentResponseDocumentation(
  options: ApiNoContentDocumentationOptions = {},
): MethodDecorator {
  return ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: options.description,
    headers: createResponseHeaders(options.headers),
  });
}

function createDataEnvelopeSchema(model: Type<unknown>): SchemaObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["data"],
    properties: {
      data: { $ref: getSchemaPath(model) },
    },
  };
}

function createListEnvelopeSchema(model: Type<unknown>): SchemaObject {
  return {
    type: "object",
    additionalProperties: false,
    required: ["data"],
    properties: {
      data: createArraySchema(model),
    },
  };
}

function createArraySchema(model: Type<unknown>): SchemaObject {
  return {
    type: "array",
    items: { $ref: getSchemaPath(model) },
  };
}

function createResponseHeaders(headers: HeadersObject = {}): HeadersObject {
  return {
    ...headers,
    [REQUEST_ID_HEADER]: {
      description: "Correlation identifier for the request.",
      schema: { type: "string", format: "uuid" },
    },
  };
}
