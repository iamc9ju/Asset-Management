import { ApiProperty } from "@nestjs/swagger";
import { USER_STATUS, type UserStatus } from "../../../iam/domain/user-status";

export class MeResponseDataDto {
  @ApiProperty({
    format: "uuid",
    example: "16c2338b-e646-4b57-8ea9-f5b78359f6a8",
  })
  user_id!: string;

  @ApiProperty({ example: "System Administrator" })
  display_name!: string;

  @ApiProperty({
    enum: Object.values(USER_STATUS),
    example: USER_STATUS.ACTIVE,
  })
  status!: UserStatus;

  @ApiProperty({
    type: "array",
    items: { type: "string" },
    example: ["assets:read", "assets:update"],
  })
  permissions!: string[];
}
