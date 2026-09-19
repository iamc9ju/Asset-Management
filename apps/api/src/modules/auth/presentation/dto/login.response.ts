import { ApiProperty } from "@nestjs/swagger";
import { AUTH_TOKEN_TYPE } from "../../domain/auth.constants";

export class LoginResponseDataDto {
  @ApiProperty({
    description: "Short-lived JWT access token.",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  access_token!: string;

  @ApiProperty({
    enum: [AUTH_TOKEN_TYPE.BEARER],
    example: AUTH_TOKEN_TYPE.BEARER,
  })
  token_type!: typeof AUTH_TOKEN_TYPE.BEARER;

  @ApiProperty({
    description: "Access-token lifetime in seconds.",
    example: 900,
  })
  expires_in!: number;
}
