import { ApiProperty } from "@nestjs/swagger";
import { APP_ERROR_CODE, type AppErrorCode } from "../../errors/app-error-code";

class ErrorBodyOpenApi {
  @ApiProperty({
    enum: Object.values(APP_ERROR_CODE),
    example: APP_ERROR_CODE.SERVICE_UNAVAILABLE,
  })
  code!: AppErrorCode;

  @ApiProperty({ example: "The service is temporarily unavailable." })
  message!: string;

  @ApiProperty({
    type: "object",
    additionalProperties: true,
    example: {},
  })
  details!: Record<string, unknown>;

  @ApiProperty({
    format: "uuid",
    example: "8ef91eb9-fb20-4f65-8835-26697a21b824",
  })
  request_id!: string;
}

export class ErrorResponseEnvelopeOpenApi {
  @ApiProperty({ type: ErrorBodyOpenApi })
  error!: ErrorBodyOpenApi;
}
