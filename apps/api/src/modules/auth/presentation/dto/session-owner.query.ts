import { Transform } from "class-transformer";
import { IsOptional, IsUUID } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class SessionOwnerQueryDto {
  @ApiPropertyOptional({
    name: "user_id",
    format: "uuid",
    description:
      "Defaults to the authenticated user. Accessing another user's sessions requires the corresponding session:*:any permission.",
    example: "16c2338b-e646-4b57-8ea9-f5b78359f6a8",
  })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsUUID()
  user_id?: string;
}
