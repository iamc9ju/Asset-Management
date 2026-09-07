import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { REQUEST_ID_HEADER } from "./shared/http/request-id/request-id.constants";
import { requestIdMiddleware } from "./shared/http/request-id/request-id.middleware";
import { createValidationPipe } from "./shared/http/validation/validation.pipe";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const port = config.getOrThrow<number>("API_PORT");
  const webOrigin = config.getOrThrow<string>("WEB_ORIGIN");

  app.use(requestIdMiddleware);
  app.useGlobalPipes(createValidationPipe());

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: webOrigin,
    credentials: true,
    exposedHeaders: [REQUEST_ID_HEADER],
  });
  app.enableShutdownHooks();

  await app.listen(port, "0.0.0.0");
}

void bootstrap();
