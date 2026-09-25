import type { AuthRetentionConfig } from "../config/auth-retention.config";
import type { AuthEventRepository } from "../ports/auth-event.port";
import type { AuthRetentionRepository } from "../ports/auth-retention-repository.port";
import type { Clock } from "../ports/clock.port";
import { CleanupAuthRetentionService } from "./cleanup-auth-retention.service";

const NOW = new Date("2026-09-25T12:00:00.000Z");
const CUTOFF = new Date("2026-08-26T12:00:00.000Z");
const CLIENT = {
  requestId: "11111111-1111-4111-8111-111111111111",
  ipAddress: null,
  userAgent: null,
} as const;

function createService() {
  const repository: jest.Mocked<AuthRetentionRepository> = {
    countEligible: jest.fn(),
    cleanup: jest.fn(),
  };
  const authEventRepository: jest.Mocked<AuthEventRepository> = {
    recordLoginFailure: jest.fn(),
    recordRateLimitExceeded: jest.fn(),
    recordAuthorizationDenied: jest.fn(),
    recordRetentionCleanupCompleted: jest.fn(),
  };
  const clock: Clock = { now: () => new Date(NOW) };
  const config: AuthRetentionConfig = {
    retentionSeconds: 2_592_000,
    batchSize: 500,
    maxBatches: 20,
  };

  return {
    service: new CleanupAuthRetentionService(
      repository,
      authEventRepository,
      clock,
      config,
    ),
    repository,
    authEventRepository,
  };
}

describe("CleanupAuthRetentionService", () => {
  it("previews eligible sessions without deleting data", async () => {
    const dependencies = createService();
    dependencies.repository.countEligible.mockResolvedValue(12);

    await expect(dependencies.service.preview()).resolves.toEqual({
      cutoff: CUTOFF,
      eligibleSessions: 12,
    });
    expect(dependencies.repository.countEligible).toHaveBeenCalledWith(CUTOFF);
    expect(dependencies.repository.cleanup).not.toHaveBeenCalled();
  });

  it("runs bounded batches and records the operational audit summary", async () => {
    const dependencies = createService();
    dependencies.repository.cleanup.mockResolvedValue({
      lockAcquired: true,
      deletedSessions: 750,
      completedBatches: 2,
      hasMore: false,
    });

    await expect(
      dependencies.service.execute({ client: CLIENT }),
    ).resolves.toEqual({
      cutoff: CUTOFF,
      lockAcquired: true,
      deletedSessions: 750,
      completedBatches: 2,
      hasMore: false,
    });
    expect(dependencies.repository.cleanup).toHaveBeenCalledWith({
      cutoff: CUTOFF,
      batchSize: 500,
      maxBatches: 20,
    });
    expect(
      dependencies.authEventRepository.recordRetentionCleanupCompleted,
    ).toHaveBeenCalledWith({
      cutoff: CUTOFF,
      deletedSessions: 750,
      completedBatches: 2,
      hasMore: false,
      occurredAt: NOW,
      client: CLIENT,
    });
  });

  it("skips the audit event when another cleanup process owns the lock", async () => {
    const dependencies = createService();
    dependencies.repository.cleanup.mockResolvedValue({
      lockAcquired: false,
      deletedSessions: 0,
      completedBatches: 0,
      hasMore: false,
    });

    await expect(
      dependencies.service.execute({ client: CLIENT }),
    ).resolves.toMatchObject({ lockAcquired: false });
    expect(
      dependencies.authEventRepository.recordRetentionCleanupCompleted,
    ).not.toHaveBeenCalled();
  });
});
