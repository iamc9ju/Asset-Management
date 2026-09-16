export const ACCESS_TOKEN_SERVICE = Symbol("ACCESS_TOKEN_SERVICE");

export interface IssueAccessTokenInput {
  userId: string;
  sessionId: string;
}

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  tokenId: string;
  issuedAt: number;
  expiresAt: number;
}

export type AccessTokenVerificationResult =
  | {
      valid: true;
      claims: AccessTokenClaims;
    }
  | {
      valid: false;
      reason: "expired" | "invalid";
    };

export interface AccessTokenService {
  issue(input: IssueAccessTokenInput): Promise<string>;
  verify(token: string): Promise<AccessTokenVerificationResult>;
}
