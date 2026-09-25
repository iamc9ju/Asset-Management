import { Inject, Injectable, type OnApplicationShutdown } from "@nestjs/common";
import type Redis from "ioredis";
import { REDIS_CLIENT } from "./infrastructure.constants";

@Injectable()
export class RedisLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.redis.status === "end") {
      return;
    }

    if (this.redis.status === "wait") {
      this.redis.disconnect();
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
