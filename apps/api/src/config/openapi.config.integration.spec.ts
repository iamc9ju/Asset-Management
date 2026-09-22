import { Controller, Get, type INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import {
  API_GLOBAL_PREFIX,
  OPENAPI_ROUTE,
} from "../shared/http/api-route.constants";
import { OPENAPI_SECURITY_SCHEME } from "../shared/http/openapi/openapi.constants";
import { configureOpenApi } from "./openapi.config";

@ApiTags("OpenAPI Test")
@Controller("openapi-test")
class OpenApiTestController {
  @Get()
  @ApiOkResponse({
    schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["ok"] },
      },
      required: ["status"],
    },
  })
  getStatus(): { readonly status: "ok" } {
    return { status: "ok" };
  }
}

interface OpenApiDocumentResponse {
  readonly info: {
    readonly title: string;
    readonly version: string;
  };
  readonly paths: Record<string, unknown>;
  readonly components?: {
    readonly securitySchemes?: Record<string, unknown>;
  };
}

describe("OpenAPI configuration integration", () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpenApiTestController],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API_GLOBAL_PREFIX);

    const values: Record<string, boolean> = {
      OPENAPI_ENABLED: true,
      OPENAPI_UI_ENABLED: false,
      AUTH_REFRESH_COOKIE_SECURE: true,
    };
    const config = {
      getOrThrow: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;

    configureOpenApi(app, config);
    await app.listen(0, "127.0.0.1");

    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") {
      throw new Error("Expected the OpenAPI test server to use a TCP port");
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("serves a JSON document with globally prefixed routes", async () => {
    const response = await fetch(`${baseUrl}/${OPENAPI_ROUTE.JSON}`);
    const document = (await response.json()) as OpenApiDocumentResponse;

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(document.info).toMatchObject({
      title: "Asset Management API",
      version: "1.0.0",
    });
    expect(document.paths).toHaveProperty(`/${API_GLOBAL_PREFIX}/openapi-test`);
    expect(document.components?.securitySchemes).toHaveProperty(
      OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN,
    );
    expect(document.components?.securitySchemes).toHaveProperty(
      OPENAPI_SECURITY_SCHEME.REFRESH_TOKEN,
      expect.objectContaining({
        type: "apiKey",
        in: "cookie",
        name: "__Secure-am_refresh",
      }),
    );
  });
});
