export const REFRESH_TOKEN_SERVICE = Symbol("REFRESH_TOKEN_SERVICE");

export interface IssuedRefreshToken {
  tokenId: string;
  rawToken: string;
  tokenHash: string;
}

export interface PresentedRefreshToken {
  tokenId: string;
  tokenHash: string;
}

export interface RefreshTokenService {
  issue(): IssuedRefreshToken;

  parseAndHash(rawToken: string): PresentedRefreshToken | null;

  hashesMatch(expectedHash: string, candidateHash: string): boolean;
}
