import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  IssuedRefreshToken,
  PresentedRefreshToken,
  RefreshTokenService,
} from "../../application/ports/refresh-token.port";

const REFRESH_TOKEN_SECRET_BYTES = 32;
const REFRESH_TOKEN_SECRET_LENGTH = 43;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SHA_256_HEX_PATTERN = /^[0-9a-f]{64}$/;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

@Injectable()
export class OpaqueRefreshTokenService implements RefreshTokenService {
  issue(): IssuedRefreshToken {
    const tokenId = randomUUID();
    const secret = randomBytes(REFRESH_TOKEN_SECRET_BYTES).toString(
      "base64url",
    );

    return {
      tokenId,
      rawToken: `${tokenId}.${secret}`,
      tokenHash: this.hashSecret(secret),
    };
  }

  parseAndHash(rawToken: string): PresentedRefreshToken | null {
    const separatorIndex = rawToken.indexOf(".");

    if (separatorIndex <= 0 || separatorIndex !== rawToken.lastIndexOf(".")) {
      return null;
    }

    const tokenId = rawToken.slice(0, separatorIndex);
    const secret = rawToken.slice(separatorIndex + 1);

    if (
      !UUID_PATTERN.test(tokenId) ||
      secret.length !== REFRESH_TOKEN_SECRET_LENGTH ||
      !BASE64URL_PATTERN.test(secret)
    ) {
      return null;
    }

    try {
      const decodedSecret = Buffer.from(secret, "base64url");

      if (
        decodedSecret.length !== REFRESH_TOKEN_SECRET_BYTES ||
        decodedSecret.toString("base64url") !== secret
      ) {
        return null;
      }
    } catch {
      return null;
    }

    return {
      tokenId,
      tokenHash: this.hashSecret(secret),
    };
  }

  hashesMatch(expectedHash: string, candidateHash: string): boolean {
    if (
      !SHA_256_HEX_PATTERN.test(expectedHash) ||
      !SHA_256_HEX_PATTERN.test(candidateHash)
    ) {
      return false;
    }

    const expected = Buffer.from(expectedHash, "hex");
    const candidate = Buffer.from(candidateHash, "hex");

    return timingSafeEqual(expected, candidate);
  }

  private hashSecret(secret: string): string {
    return createHash("sha256").update(secret, "utf8").digest("hex");
  }
}
