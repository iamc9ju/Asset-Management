import type { UserStatus } from "../../domain/user-status";

export const IAM_AUTH_QUERY = Symbol("IAM_AUTH_QUERY");

export interface IamAuthenticationUser {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly permissionVersion: string;
}

export interface IamAuthorizationContext {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly status: UserStatus;
  readonly permissionVersion: string;
  readonly permissionCodes: readonly string[];
}

export interface IamAuthQuery {
  findAuthenticationUserByEmail(
    email: string,
  ): Promise<IamAuthenticationUser | null>;

  findAuthorizationContextByUserId(
    userId: string,
  ): Promise<IamAuthorizationContext | null>;
}
