const MILLISECONDS_PER_SECOND = 1_000;

export interface SessionTtlPolicy {
  readonly idleTtlSeconds: number; // ระยะเวลาสูงสุดที่อนุญาตให้ Session คงอยู่ได้ นับจากการใช้งานครั้งล่าสุด
  readonly absoluteTtlSeconds: number; // ระยะเวลาสูงสุดที่ Session จะมีอายุอยู่ได้นับตั้งแต่สร้างขึ้น
}

export interface InitialSessionExpiration {
  readonly idleExpiresAt: Date;
  readonly absoluteExpiresAt: Date;
}

export function calculateRefreshedIdleExpiration(
  now: Date,
  absoluteExpiresAt: Date,
  idleTtlSeconds: number,
): Date {
  return new Date(
    Math.min(
      addSeconds(now, idleTtlSeconds).getTime(),
      absoluteExpiresAt.getTime(),
    ),
  );
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
