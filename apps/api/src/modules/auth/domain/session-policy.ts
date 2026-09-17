const MILLISECONDS_PER_SECOND = 1_000;

export interface SessionTtlPolicy {
  readonly idleTtlSeconds: number;
  readonly absoluteTtlSeconds: number;
}

export interface InitialSessionExpiration {
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export function calculateInitialSessionExpiration(
  now: Date,
  config: SessionTtlPolicy,
): InitialSessionExpiration {
  const absoluteExpiresAt = addSeconds(now, config.absoluteTtlSeconds);
  const configuredIdleExpiresAt = addSeconds(now, config.idleTtlSeconds);
  const idleExpiresAt = new Date(
    Math.min(configuredIdleExpiresAt.getTime(), absoluteExpiresAt.getTime()),
  );

  return {
    idleExpiresAt,
    absoluteExpiresAt,
  };
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * MILLISECONDS_PER_SECOND);
}
