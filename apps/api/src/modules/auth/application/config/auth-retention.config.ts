export interface AuthRetentionConfig {
  readonly retentionSeconds: number;
  readonly batchSize: number;
  readonly maxBatches: number;
}

export const AUTH_RETENTION_CONFIG = Symbol("AUTH_RETENTION_CONFIG");
