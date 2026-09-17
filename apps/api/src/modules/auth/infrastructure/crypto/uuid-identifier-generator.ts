import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { IdentifierGenerator } from "../../application/ports/identifier-generator.port";

@Injectable()
export class UuidIdentifierGenerator implements IdentifierGenerator {
  generate(): string {
    return randomUUID();
  }
}
