import { PinoLogger } from "nestjs-pino";
import { ApplicationLifecycleLogger } from "./application-lifecycle.logger";
import { LOG_EVENTS } from "./log-event.constants";

describe("ApplicationLifecycleLogger", () => {
  let info: jest.Mock;
  let setContext: jest.Mock;
  let flush: jest.Mock;
  let lifecycleLogger: ApplicationLifecycleLogger;

  beforeEach(() => {
    info = jest.fn();
    setContext = jest.fn();
    flush = jest.fn((callback?: (error?: Error) => void) => {
      callback?.();
    });

    const pinoLogger = {
      info,
      setContext,
      logger: {
        flush,
      },
    } as unknown as PinoLogger;

    lifecycleLogger = new ApplicationLifecycleLogger(pinoLogger);
  });

  it("sets a stable logger context", () => {
    expect(setContext).toHaveBeenCalledTimes(1);
    expect(setContext).toHaveBeenCalledWith(ApplicationLifecycleLogger.name);
  });

  it("writes application_started after the server starts", () => {
    lifecycleLogger.logStarted(3000);

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      {
        event: LOG_EVENTS.APPLICATION_STARTED,
        port: 3000,
      },
      "Application started",
    );
  });

  it("writes and flushes application_stopping with the signal", async () => {
    await lifecycleLogger.beforeApplicationShutdown("SIGTERM");

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      {
        event: LOG_EVENTS.APPLICATION_STOPPING,
        signal: "SIGTERM",
      },
      "Application stopping",
    );
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("omits signal when shutdown was not triggered by a signal", async () => {
    await lifecycleLogger.beforeApplicationShutdown();

    expect(info).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      {
        event: LOG_EVENTS.APPLICATION_STOPPING,
      },
      "Application stopping",
    );
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("reports a transport flush failure", async () => {
    const flushError = new Error("Unable to flush logging transport");

    flush.mockImplementationOnce((callback?: (error?: Error) => void) => {
      callback?.(flushError);
    });

    await expect(
      lifecycleLogger.beforeApplicationShutdown("SIGINT"),
    ).rejects.toBe(flushError);
  });
});
