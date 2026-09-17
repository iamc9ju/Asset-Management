export const IDENTIFIER_GENERATOR = Symbol("IDENTIFIER_GENERATOR");

export interface IdentifierGenerator {
  generate(): string;
}
