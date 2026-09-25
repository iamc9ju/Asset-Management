export const AUTH_RETENTION_REPOSITORY = Symbol("AUTH_RETENTION_REPOSITORY");

export interface CleanupAuthRetentionInput {
  readonly cutoff: Date;
  readonly batchSize: number;
  readonly maxBatches: number;
}

export interface CleanupAuthRetentionResult {
  readonly lockAcquired: boolean;
  readonly deletedSessions: number;
  readonly completedBatches: number;
  readonly hasMore: boolean;
}

export interface AuthRetentionRepository {
  countEligible(cutoff: Date): Promise<number>;
  cleanup(
    input: CleanupAuthRetentionInput,
  ): Promise<CleanupAuthRetentionResult>;
}
