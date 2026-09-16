import { ApiProperty } from "@nestjs/swagger";

const HEALTH_STATUS = {
  OK: "ok",
} as const;

const DEPENDENCY_STATUS = {
  UP: "up",
  DOWN: "down",
} as const;

class DependencyHealthOpenApi {
  @ApiProperty({ enum: Object.values(DEPENDENCY_STATUS) })
  postgres!: (typeof DEPENDENCY_STATUS)[keyof typeof DEPENDENCY_STATUS];

  @ApiProperty({ enum: Object.values(DEPENDENCY_STATUS) })
  redis!: (typeof DEPENDENCY_STATUS)[keyof typeof DEPENDENCY_STATUS];

  @ApiProperty({ enum: Object.values(DEPENDENCY_STATUS) })
  seaweedfs!: (typeof DEPENDENCY_STATUS)[keyof typeof DEPENDENCY_STATUS];
}

export class LivenessResponseOpenApi {
  @ApiProperty({ enum: [HEALTH_STATUS.OK], example: HEALTH_STATUS.OK })
  status!: typeof HEALTH_STATUS.OK;

  @ApiProperty({ format: "date-time" })
  timestamp!: string;
}

export class ReadinessResponseOpenApi {
  @ApiProperty({ enum: [HEALTH_STATUS.OK], example: HEALTH_STATUS.OK })
  status!: typeof HEALTH_STATUS.OK;

  @ApiProperty({ type: DependencyHealthOpenApi })
  services!: DependencyHealthOpenApi;

  @ApiProperty({ format: "date-time" })
  timestamp!: string;
}
