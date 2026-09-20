import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import type {
  AuthSessionQuery,
  AuthSessionState,
} from "../../application/ports/auth-session-query.port";
import { AuthSessionOrmEntity } from "./entities/auth-session.orm-entity";

@Injectable()
export class TypeOrmAuthSessionQueryRepository implements AuthSessionQuery {
  constructor(
    @InjectRepository(AuthSessionOrmEntity)
    private readonly sessions: Repository<AuthSessionOrmEntity>,
  ) {}

  async findByIdAndUserId(
    sessionId: string,
    userId: string,
  ): Promise<AuthSessionState | null> {
    const session = await this.sessions.findOne({
      select: {
        id: true,
        userId: true,
        idleExpiresAt: true,
        expiresAt: true,
        revokedAt: true,
      },
      where: { id: sessionId, userId },
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.userId,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.expiresAt,
      revokedAt: session.revokedAt,
    };
  }
}
