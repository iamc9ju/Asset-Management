export interface AccessTokenSigningKey {
  id: string;
  secret: string;
}

export interface AccessTokenConfig {
  issuer: string; //ใครเป็นคนออก
  audience: string; //ต้องการออกให้ใครเอาไปใช้
  ttlSeconds: number;
  currentKey: AccessTokenSigningKey;
  previousKey?: AccessTokenSigningKey;
}

export const ACCESS_TOKEN_CONFIG = Symbol("ACCESS_TOKEN_CONFIG");
