import type { INestApplication } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import {
  DocumentBuilder,
  SwaggerModule,
  type SwaggerDocumentOptions,
} from "@nestjs/swagger";
import { OPENAPI_ROUTE } from "../shared/http/api-route.constants";

export const OPENAPI_SECURITY_SCHEME = {
  ACCESS_TOKEN: "access-token",
} as const;

const OPENAPI_DOCUMENT_TITLE = "Asset Management API";
const OPENAPI_DOCUMENT_DESCRIPTION =
  "HTTP API for asset custody, lifecycle, audit, and identity operations.";
const OPENAPI_DOCUMENT_VERSION = "1.0.0";
const OPENAPI_SITE_TITLE = "Asset Management API Documentation";

export function configureOpenApi(
  app: INestApplication,
  config: ConfigService,
): boolean {
  const enabled = config.getOrThrow<boolean>("OPENAPI_ENABLED");

  if (!enabled) {
    return false;
  }

  const uiEnabled = config.getOrThrow<boolean>("OPENAPI_UI_ENABLED");
  const documentConfig = new DocumentBuilder()
    .setTitle(OPENAPI_DOCUMENT_TITLE)
    .setDescription(OPENAPI_DOCUMENT_DESCRIPTION)
    .setVersion(OPENAPI_DOCUMENT_VERSION)
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Short-lived access token returned by an authentication endpoint.",
      },
      OPENAPI_SECURITY_SCHEME.ACCESS_TOKEN,
    )
    .build();
  const documentOptions: SwaggerDocumentOptions = {
    autoTagControllers: false,
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey, version) => {
      const controllerName = controllerKey.endsWith("Controller")
        ? controllerKey.slice(0, -"Controller".length)
        : controllerKey;
      const versionSuffix = version ? `_${String(version)}` : "";

      return `${controllerName}_${methodKey}${versionSuffix}`;
    },
  };
  const documentFactory = () =>
    SwaggerModule.createDocument(app, documentConfig, documentOptions);

  SwaggerModule.setup(OPENAPI_ROUTE.UI, app, documentFactory, {
    customSiteTitle: OPENAPI_SITE_TITLE,
    jsonDocumentUrl: OPENAPI_ROUTE.JSON,
    raw: ["json"],
    ui: uiEnabled,
    useGlobalPrefix: false,
    swaggerOptions: {
      displayRequestDuration: true,
      filter: true,
      persistAuthorization: false,
      tryItOutEnabled: false,
    },
  });

  return true;
}
