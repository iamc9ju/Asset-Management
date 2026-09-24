import { ApiProperty } from "@nestjs/swagger";

export class SessionResponseDataDto {
  @ApiProperty({
    format: "uuid",
    example: "7671d9f6-590f-4f87-b1cc-17196d42bab9",
  })
  session_id!: string;

  @ApiProperty({
    format: "uuid",
    example: "16c2338b-e646-4b57-8ea9-f5b78359f6a8",
  })
  user_id!: string;

  @ApiProperty({ example: "Chrome on macOS", nullable: true })
  device_label!: string | null;

  @ApiProperty({ format: "date-time", example: "2026-09-24T08:00:00.000Z" })
  created_at!: string;

  @ApiProperty({
    format: "date-time",
    example: "2026-09-24T09:00:00.000Z",
    nullable: true,
  })
  last_used_at!: string | null;

  @ApiProperty({ format: "date-time", example: "2026-10-01T09:00:00.000Z" })
  idle_expires_at!: string;

  @ApiProperty({ format: "date-time", example: "2026-10-24T08:00:00.000Z" })
  expires_at!: string;

  @ApiProperty({ example: true })
  is_current!: boolean;
}
