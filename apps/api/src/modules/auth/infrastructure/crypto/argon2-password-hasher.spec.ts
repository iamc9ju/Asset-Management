import { Argon2PasswordHasher } from "./argon2-password-hasher";

describe("Argon2PasswordHasher", () => {
  const hasher = new Argon2PasswordHasher();
  const password = "Correct-Horse-Battery-Staple-2026!";

  it("hashes and verifies a password with Argon2id", async () => {
    const passwordHash = await hasher.hash(password);

    expect(passwordHash).toMatch(
      /^\$argon2id\$v=19\$m=19456,p=1,t=2\$/,
    );
    await expect(hasher.verify(passwordHash, password)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const passwordHash = await hasher.hash(password);

    await expect(
      hasher.verify(passwordHash, "incorrect-password"),
    ).resolves.toBe(false);
  });

  it("generates a different salted hash for the same password", async () => {
    const firstHash = await hasher.hash(password);
    const secondHash = await hasher.hash(password);

    expect(firstHash).not.toBe(secondHash);
  });

  it("returns false for a malformed password hash", async () => {
    await expect(
      hasher.verify("not-an-argon2-hash", password),
    ).resolves.toBe(false);
  });

  it("consumes Argon2 work for an unknown account without returning a hash", async () => {
    await expect(
      hasher.consumeVerificationCost(password),
    ).resolves.toBeUndefined();
  });
});
