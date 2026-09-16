import { JwtService } from "@nestjs/jwt";
import type {
  AccessTokenConfig,
  AccessTokenSigningKey,
} from "../../application/config/access-token.config";
import type { Clock } from "../../application/ports/clock.port";
import { JwtAccessTokenService } from "./jwt-access-token.service";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const TOKEN_ID = "33333333-3333-4333-8333-333333333333";
const NOW = new Date("2026-09-16T05:00:00.000Z");
const NOW_IN_SECONDS = Math.floor(NOW.getTime() / 1_000);

const CONFIG: AccessTokenConfig = {
  issuer: "asset-management-api",
  audience: "asset-management-web",
  ttlSeconds: 900,
  currentKey: {
    id: "v2",
    secret: "current-test-signing-secret-with-at-least-256-bits-of-entropy",
  },
  previousKey: {
    id: "v1",
    secret: "previous-test-signing-secret-with-at-least-256-bits-entropy",
  },
};

describe("JwtAccessTokenService", () => {
  const jwtService = new JwtService();
  const clock: Clock = {
    now: () => NOW,
  };
  const service = new JwtAccessTokenService(jwtService, CONFIG, clock);

  function signTestToken({
    key = CONFIG.currentKey,
    keyId = key.id,
    issuer = CONFIG.issuer,
    audience = CONFIG.audience,
    sessionId = SESSION_ID,
    expiresIn = 900,
    issuedAt = NOW_IN_SECONDS,
  }: {
    key?: AccessTokenSigningKey;
    keyId?: string;
    issuer?: string;
    audience?: string;
    sessionId?: string;
    expiresIn?: number;
    issuedAt?: number;
  } = {}): Promise<string> {
    return jwtService.signAsync(
      {
        sid: sessionId,
        iat: issuedAt,
        exp: issuedAt + expiresIn,
      },
      {
        algorithm: "HS256",
        issuer,
        audience,
        subject: USER_ID,
        jwtid: TOKEN_ID,
        secret: key.secret,
        header: {
          alg: "HS256",
          typ: "JWT",
          kid: keyId,
        },
      },
    );
  }

  it("issues and verifies a token with the current signing key", async () => {
    const token = await service.issue({
      userId: USER_ID,
      sessionId: SESSION_ID,
    });

    const result = await service.verify(token);

    expect(result.valid).toBe(true);

    if (!result.valid) {
      throw new Error("Expected a valid access token");
    }

    expect(result.claims.userId).toBe(USER_ID);
    expect(result.claims.sessionId).toBe(SESSION_ID);
    expect(result.claims.tokenId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(result.claims.issuedAt).toBe(NOW_IN_SECONDS);
    expect(result.claims.expiresAt).toBe(NOW_IN_SECONDS + CONFIG.ttlSeconds);
  });

  it("accepts a token signed with the previous signing key", async () => {
    const token = await signTestToken({
      key: CONFIG.previousKey!,
    });

    await expect(service.verify(token)).resolves.toMatchObject({
      valid: true,
    });
  });

  it("rejects a token with an unknown signing key ID", async () => {
    const token = await signTestToken({
      keyId: "unknown",
    });

    await expect(service.verify(token)).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects a token signed with an untrusted secret", async () => {
    const token = await signTestToken({
      key: {
        id: CONFIG.currentKey.id,
        secret: "untrusted-test-signing-secret-with-at-least-256-bits-entropy",
      },
    });

    await expect(service.verify(token)).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects a token with the wrong issuer", async () => {
    const token = await signTestToken({
      issuer: "untrusted-api",
    });

    await expect(service.verify(token)).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects a token with the wrong audience", async () => {
    const token = await signTestToken({
      audience: "untrusted-client",
    });

    await expect(service.verify(token)).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects a token with malformed required claims", async () => {
    const token = await signTestToken({
      sessionId: "not-a-uuid",
    });

    await expect(service.verify(token)).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("reports an expired token separately", async () => {
    const token = await signTestToken({
      expiresIn: -1,
    });

    await expect(service.verify(token)).resolves.toEqual({
      valid: false,
      reason: "expired",
    });
  });

  it("rejects a token issued in the future", async () => {
    const token = await signTestToken({
      issuedAt: NOW_IN_SECONDS + 1,
    });

    await expect(service.verify(token)).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });

  it("rejects a malformed token", async () => {
    await expect(service.verify("not-a-jwt")).resolves.toEqual({
      valid: false,
      reason: "invalid",
    });
  });
});
