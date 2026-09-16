import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ACCESS_TOKEN_CONFIG,
  type AccessTokenConfig,
  type AccessTokenSigningKey,
} from "../../application/config/access-token.config";
import type {
  AccessTokenService,
  AccessTokenVerificationResult,
  IssueAccessTokenInput,
} from "../../application/ports/access-token.port";
import { CLOCK, type Clock } from "../../application/ports/clock.port";

interface JwtHeader {
  alg?: unknown;
  typ?: unknown;
  kid?: unknown;
}

interface JwtPayload {
  sub?: unknown;
  sid?: unknown;
  jti?: unknown;
  iat?: unknown;
  exp?: unknown;
}

interface VerifiedJwtPayload extends JwtPayload {
  sub: string;
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class JwtAccessTokenService implements AccessTokenService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(ACCESS_TOKEN_CONFIG)
    private readonly config: AccessTokenConfig,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  issue(input: IssueAccessTokenInput): Promise<string> {
    const issuedAt = this.currentUnixTime();

    return this.jwtService.signAsync(
      {
        sid: input.sessionId,
        iat: issuedAt,
        exp: issuedAt + this.config.ttlSeconds,
      },
      {
        algorithm: "HS256",
        issuer: this.config.issuer,
        audience: this.config.audience,
        subject: input.userId,
        jwtid: randomUUID(),
        secret: this.config.currentKey.secret,
        header: {
          alg: "HS256",
          typ: "JWT",
          kid: this.config.currentKey.id,
        },
      },
    );
  }

  async verify(token: string): Promise<AccessTokenVerificationResult> {
    const signingKey = this.resolveSigningKey(token);

    if (!signingKey) {
      return {
        valid: false,
        reason: "invalid",
      };
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        algorithms: ["HS256"],
        issuer: this.config.issuer,
        audience: this.config.audience,
        secret: signingKey.secret,
        clockTimestamp: this.currentUnixTime(),
      });

      if (!this.hasValidClaims(payload)) {
        return {
          valid: false,
          reason: "invalid",
        };
      }

      return {
        valid: true,
        claims: {
          userId: payload.sub,
          sessionId: payload.sid,
          tokenId: payload.jti,
          issuedAt: payload.iat,
          expiresAt: payload.exp,
        },
      };
    } catch (error: unknown) {
      return {
        valid: false,
        reason: this.isExpiredTokenError(error) ? "expired" : "invalid",
      };
    }
  }

  private resolveSigningKey(token: string): AccessTokenSigningKey | null {
    const header = this.readHeader(token);

    if (
      !header ||
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      typeof header.kid !== "string"
    ) {
      return null;
    }

    if (header.kid === this.config.currentKey.id) {
      return this.config.currentKey;
    }

    if (header.kid === this.config.previousKey?.id) {
      return this.config.previousKey;
    }

    return null;
  }

  private readHeader(token: string): JwtHeader | null {
    const segments = token.split(".");

    if (segments.length !== 3 || !segments[0]) {
      return null;
    }

    try {
      const decodedHeader = Buffer.from(segments[0], "base64url").toString(
        "utf8",
      );
      const header: unknown = JSON.parse(decodedHeader);

      if (!header || typeof header !== "object") {
        return null;
      }

      return header as JwtHeader;
    } catch {
      return null;
    }
  }

  private hasValidClaims(payload: JwtPayload): payload is VerifiedJwtPayload {
    return (
      typeof payload.sub === "string" &&
      UUID_PATTERN.test(payload.sub) &&
      typeof payload.sid === "string" &&
      UUID_PATTERN.test(payload.sid) &&
      typeof payload.jti === "string" &&
      UUID_PATTERN.test(payload.jti) &&
      typeof payload.iat === "number" &&
      Number.isInteger(payload.iat) &&
      payload.iat <= this.currentUnixTime() &&
      typeof payload.exp === "number" &&
      Number.isInteger(payload.exp) &&
      payload.exp > payload.iat
    );
  }

  private isExpiredTokenError(error: unknown): boolean {
    return error instanceof Error && error.name === "TokenExpiredError";
  }

  private currentUnixTime(): number {
    return Math.floor(this.clock.now().getTime() / 1_000);
  }
}
