import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { SwaggerModule, type OpenAPIObject } from "@nestjs/swagger";
import { OPENAPI_ROUTE } from "../shared/http/api-route.constants";
import { OPENAPI_SECURITY_SCHEME, configureOpenApi } from "./openapi.config";

function createConfigService(values: Record<string, boolean>): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => {
      if (!(key in values)) {
        throw new Error(`Missing test configuration: ${key}`);
      }

      return values[key];
    }),
  } as unknown as ConfigService;
}

describe("configureOpenApi", () => {
  const app = {} as INestApplication;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("does not expose documentation endpoints when OpenAPI is disabled", () => {
    const setup = jest.spyOn(SwaggerModule, "setup");

    expect(
      configureOpenApi(
        app,
        createConfigService({
          OPENAPI_ENABLED: false,
          OPENAPI_UI_ENABLED: false,
        }),
      ),
    ).toBe(false);
    expect(setup).not.toHaveBeenCalled();
  });

  it("registers lazy JSON documentation with an optional UI", () => {
    const document = { openapi: "3.0.0" } as OpenAPIObject;
    const createDocument = jest
      .spyOn(SwaggerModule, "createDocument")
      .mockReturnValue(document);
    const setup = jest
      .spyOn(SwaggerModule, "setup")
      .mockImplementation(() => undefined);

    expect(
      configureOpenApi(
        app,
        createConfigService({
          OPENAPI_ENABLED: true,
          OPENAPI_UI_ENABLED: false,
        }),
      ),
    ).toBe(true);

    expect(setup).toHaveBeenCalledWith(
      OPENAPI_ROUTE.UI,
      app,
      expect.any(Function),
      expect.objectContaining({
        jsonDocumentUrl: OPENAPI_ROUTE.JSON,
        raw: ["json"],
        ui: false,
        useGlobalPrefix: false,
      }),
    );

    const documentFactory = setup.mock.calls[0]?.[2];
    if (typeof documentFactory !== "function") {
      throw new Error("Expected a lazy OpenAPI document factory");
    }

    expect(documentFactory()).toBe(document);
    expect(createDocument).toHaveBeenCalledWith(
      app,
      expect.objectContaining({
        info: expect.objectContaining({
          title: "Asset Management API",
          version: "1.0.0",
        }),
        components: expect.objectContaining({
          securitySchemes: expect.objectContaining({
            [OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN]: expect.any(Object),
          }),
        }),
      }),
      expect.objectContaining({
        autoTagControllers: false,
        deepScanRoutes: true,
        operationIdFactory: expect.any(Function),
      }),
    );
  });
});
