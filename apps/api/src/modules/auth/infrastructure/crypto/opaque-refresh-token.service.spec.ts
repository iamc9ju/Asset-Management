import { createHash } from "node:crypto";
import { OpaqueRefreshTokenService } from "./opaque-refresh-token.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("OpaqueRefreshTokenService", () => {
  const service = new OpaqueRefreshTokenService();

  it("issues a token with a UUID selector and a 256-bit secret", () => {
    const issued = service.issue();
    const separatorIndex = issued.rawToken.indexOf(".");
    const tokenId = issued.rawToken.slice(0, separatorIndex);
    const secret = issued.rawToken.slice(separatorIndex + 1);

    expect(issued.tokenId).toBe(tokenId);
    expect(tokenId).toMatch(UUID_PATTERN);
    expect(Buffer.from(secret, "base64url")).toHaveLength(32);
    expect(secret).toHaveLength(43);
  });

  it("stores the lowercase SHA-256 hash of the secret", () => {
    const issued = service.issue();
    const separatorIndex = issued.rawToken.indexOf(".");
    const secret = issued.rawToken.slice(separatorIndex + 1);
    const expectedHash = createHash("sha256")
      .update(secret, "utf8")
      .digest("hex");

    expect(issued.tokenHash).toBe(expectedHash);
    expect(issued.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("parses a presented token without returning its raw secret", () => {
    const issued = service.issue();

    expect(service.parseAndHash(issued.rawToken)).toEqual({
      tokenId: issued.tokenId,
      tokenHash: issued.tokenHash,
    });
  });

  it("issues unique selectors, secrets, and hashes", () => {
    const first = service.issue();
    const second = service.issue();

    expect(first.tokenId).not.toBe(second.tokenId);
    expect(first.rawToken).not.toBe(second.rawToken);
    expect(first.tokenHash).not.toBe(second.tokenHash);
  });

  it.each([
    "",
    "not-a-token",
    "not-a-uuid.secret",
    "11111111-1111-4111-8111-111111111111.",
    "11111111-1111-4111-8111-111111111111.too-short",
    "11111111-1111-4111-8111-111111111111.invalid.secret",
    "11111111-1111-4111-8111-111111111111.!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
  ])("rejects malformed token %p", (rawToken) => {
    expect(service.parseAndHash(rawToken)).toBeNull();
  });

  it("matches only the expected token hash", () => {
    const expected = service.issue();
    const different = service.issue();

    expect(service.hashesMatch(expected.tokenHash, expected.tokenHash)).toBe(
      true,
    );

    expect(service.hashesMatch(expected.tokenHash, different.tokenHash)).toBe(
      false,
    );
  });

  it("rejects malformed hashes before constant-time comparison", () => {
    const issued = service.issue();

    expect(service.hashesMatch("not-a-hash", issued.tokenHash)).toBe(false);
    expect(service.hashesMatch(issued.tokenHash, "ABC")).toBe(false);
  });
});
