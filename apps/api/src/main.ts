import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { REQUEST_ID_HEADER } from "./shared/http/request-id/request-id.constants";
import { requestIdMiddleware } from "./shared/http/request-id/request-id.middleware";
import { createValidationPipe } from "./shared/http/validation/validation.pipe";
import { Logger } from "nestjs-pino";
import { ApplicationLifecycleLogger } from "./shared/logging/application-lifecycle.logger";
import { configureOpenApi } from "./config/openapi.config";
import { API_GLOBAL_PREFIX } from "./shared/http/api-route.constants";
import type { NestExpressApplication } from "@nestjs/platform-express";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  const lifecycleLogger = app.get(ApplicationLifecycleLogger);

  const port = config.getOrThrow<number>("API_PORT");
  const webOrigin = config.getOrThrow<string>("WEB_ORIGIN");
  const trustProxyHops = config.getOrThrow<number>("HTTP_TRUST_PROXY_HOPS");

  if (trustProxyHops > 0) {
    app.set("trust proxy", trustProxyHops);
  }

  app.use(requestIdMiddleware);
  app.useGlobalPipes(createValidationPipe());

  app.setGlobalPrefix(API_GLOBAL_PREFIX);
  app.enableCors({
    origin: webOrigin,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.enableShutdownHooks();
  configureOpenApi(app, config);

  await app.listen(port, "0.0.0.0");
  lifecycleLogger.logStarted(port);
}

void bootstrap();
