import { Controller, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ApiProperty, DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  ApiDataResponseDocumentation,
  ApiListResponseDocumentation,
  ApiNoContentResponseDocumentation,
  ApiPaginatedResponseDocumentation,
} from "./api-response.openapi";

class ExampleResourceOpenApi {
  @ApiProperty({ format: "uuid" })
  id!: string;
}

@Controller("response-documentation-test")
class ResponseDocumentationTestController {
  @Get("single")
  @ApiDataResponseDocumentation({ model: ExampleResourceOpenApi })
  single(): void {}

  @Get("list")
  @ApiListResponseDocumentation({ model: ExampleResourceOpenApi })
  list(): void {}

  @Get("paginated")
  @ApiPaginatedResponseDocumentation({ model: ExampleResourceOpenApi })
  paginated(): void {}

  @Get("empty")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponseDocumentation()
  empty(): void {}
}

describe("API response OpenAPI documentation", () => {
  it("publishes the standard data, list, pagination, and no-content contracts", async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ResponseDocumentationTestController],
    }).compile();
    const app = moduleRef.createNestApplication();

    try {
      await app.init();
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle("Response test").setVersion("1").build(),
      );
      const paths = document.paths;
      const singleResponse =
        paths["/response-documentation-test/single"]?.get?.responses["200"];
      const listResponse =
        paths["/response-documentation-test/list"]?.get?.responses["200"];
      const paginatedResponse =
        paths["/response-documentation-test/paginated"]?.get?.responses["200"];
      const noContentResponse =
        paths["/response-documentation-test/empty"]?.get?.responses["204"];

      expect(singleResponse).toMatchObject({
        headers: {
          "x-request-id": {
            schema: { type: "string", format: "uuid" },
          },
        },
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["data"],
              properties: {
                data: {
                  $ref: "#/components/schemas/ExampleResourceOpenApi",
                },
              },
            },
          },
        },
      });
      expect(listResponse).toMatchObject({
        content: {
          "application/json": {
            schema: {
              required: ["data"],
              properties: {
                data: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/ExampleResourceOpenApi",
                  },
                },
              },
            },
          },
        },
      });
      expect(paginatedResponse).toMatchObject({
        content: {
          "application/json": {
            schema: {
              required: ["data", "meta"],
              properties: {
                data: { type: "array" },
                meta: {
                  $ref: "#/components/schemas/ApiPaginationMetaOpenApi",
                },
              },
            },
          },
        },
      });
      expect(noContentResponse).toMatchObject({
        headers: {
          "x-request-id": {
            schema: { type: "string", format: "uuid" },
          },
        },
      });
      expect(document.components?.schemas).toHaveProperty(
        "ApiPaginationMetaOpenApi",
      );
    } finally {
      await app.close();
    }
  });
});
