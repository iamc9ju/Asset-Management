import { Transform } from "class-transformer";
import {
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  AUTH_CLIENT_METADATA_LIMIT,
  AUTH_CREDENTIAL_LIMIT,
} from "../../domain/auth.constants";

function trimString(value: unknown): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class LoginRequestDto {
  @ApiProperty({
    format: "email",
    maxLength: AUTH_CREDENTIAL_LIMIT.EMAIL_LENGTH,
    example: "user@example.com",
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(AUTH_CREDENTIAL_LIMIT.EMAIL_LENGTH)
  @IsEmail({}, { message: "email must be a valid email address" })
  email!: string;

  @ApiProperty({
    format: "password",
    minLength: 1,
    maxLength: AUTH_CREDENTIAL_LIMIT.PASSWORD_LENGTH,
    writeOnly: true,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_CREDENTIAL_LIMIT.PASSWORD_LENGTH)
  password!: string;

  @ApiPropertyOptional({
    maxLength: AUTH_CLIENT_METADATA_LIMIT.DEVICE_LABEL_LENGTH,
    example: "Chrome on macOS",
  })
  @Transform(({ value }) => trimString(value))
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(AUTH_CLIENT_METADATA_LIMIT.DEVICE_LABEL_LENGTH)
  device_label?: string;
}
