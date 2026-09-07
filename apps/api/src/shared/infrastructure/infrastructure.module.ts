import { S3Client } from "@aws-sdk/client-s3";
import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT, S3_CLIENT } from "./infrastructure.constants";

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.getOrThrow<string>("REDIS_URL");

        return new Redis(redisUrl, {
          lazyConnect: true, //อย่าเพิ่งเชื่อม Redis ทันทีตอนสร้าง Redis instance
          enableReadyCheck: true,
          maxRetriesPerRequest: 2,
          connectTimeout: 10_000,
        });
      },
    },
    {
      provide: S3_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new S3Client({
          endpoint: config.get("S3_ENDPOINT", "http://localhost:8333"),
          region: config.get("S3_REGION", "us-east-1"),
          forcePathStyle: config.getOrThrow<boolean>("S3_FORCE_PATH_STYLE"),
          credentials: {
            accessKeyId: config.getOrThrow<string>("S3_ACCESS_KEY"),
            secretAccessKey: config.getOrThrow<string>("S3_SECRET_KEY"),
          },
        }),
    },
  ],
  exports: [REDIS_CLIENT, S3_CLIENT],
})
export class InfrastructureModule {}
