import { Injectable, type BeforeApplicationShutdown } from "@nestjs/common";
import { PinoLogger } from "nestjs-pino";
import { LOG_EVENTS } from "./log-event.constants";
import type {
  ApplicationStartedLogFields,
  ApplicationStoppingLogFields,
} from "./logging.types";

const APPLICATION_STARTED_MESSAGE = "Application started";
const APPLICATION_STOPPING_MESSAGE = "Application stopping";

@Injectable()
export class ApplicationLifecycleLogger implements BeforeApplicationShutdown {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(ApplicationLifecycleLogger.name);
  }

  logStarted(port: number): void {
    const fields = {
      event: LOG_EVENTS.APPLICATION_STARTED,
      port,
    } satisfies ApplicationStartedLogFields;

    this.logger.info(fields, APPLICATION_STARTED_MESSAGE);
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    const fields = {
      event: LOG_EVENTS.APPLICATION_STOPPING,
      ...(signal ? { signal } : {}),
    } satisfies ApplicationStoppingLogFields;

    this.logger.info(fields, APPLICATION_STOPPING_MESSAGE);

    await this.flush();
  }

  private async flush(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.logger.logger.flush((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}
