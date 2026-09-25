import type { AuthRetentionConfig } from "../config/auth-retention.config";
import type { AuthClientContext } from "../ports/auth-client-context.port";
import type { AuthEventRepository } from "../ports/auth-event.port";
import type {
  AuthRetentionRepository,
  CleanupAuthRetentionResult,
} from "../ports/auth-retention-repository.port";
import type { Clock } from "../ports/clock.port";

export interface AuthRetentionPreview {
  readonly cutoff: Date;
  readonly eligibleSessions: number;
}

export interface RunAuthRetentionCleanupInput {
  readonly client: AuthClientContext;
}

export interface RunAuthRetentionCleanupResult
  extends CleanupAuthRetentionResult {
  readonly cutoff: Date;
}

export class CleanupAuthRetentionService {
  constructor(
    private readonly repository: AuthRetentionRepository,
    private readonly authEventRepository: AuthEventRepository,
    private readonly clock: Clock,
    private readonly config: AuthRetentionConfig,
  ) {}

  async preview(): Promise<AuthRetentionPreview> {
    const cutoff = this.resolveCutoff();
    const eligibleSessions = await this.repository.countEligible(cutoff);

    return { cutoff, eligibleSessions };
  }

  async execute(
    input: RunAuthRetentionCleanupInput,
  ): Promise<RunAuthRetentionCleanupResult> {
    const cutoff = this.resolveCutoff();
    const result = await this.repository.cleanup({
      cutoff,
      batchSize: this.config.batchSize,
      maxBatches: this.config.maxBatches,
    });

    if (result.lockAcquired) {
      await this.authEventRepository.recordRetentionCleanupCompleted({
        cutoff,
        deletedSessions: result.deletedSessions,
        completedBatches: result.completedBatches,
        hasMore: result.hasMore,
        occurredAt: this.clock.now(),
        client: input.client,
      });
    }

    return { cutoff, ...result };
  }

  private resolveCutoff(): Date {
    return new Date(
      this.clock.now().getTime() - this.config.retentionSeconds * 1_000,
    );
  }
}
