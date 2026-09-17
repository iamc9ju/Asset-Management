import { Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { PasswordHasher } from "../../application/ports/password-hasher.port";

const ARGON2_OPTIONS = {
  type: argon2.argon2id, //ป้องกัน Side-channel ป้องกัน Brute-force
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  async consumeVerificationCost(password: string): Promise<void> {
    await argon2.hash(password, ARGON2_OPTIONS);
  }
}
