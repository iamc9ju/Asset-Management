import { Inject, Injectable } from "@nestjs/common";
import type { AuthClientContext } from "../ports/auth-client-context.port";
import { CLOCK, type Clock } from "../ports/clock.port";
import {
  REFRESH_TOKEN_SERVICE,
  type RefreshTokenService,
} from "../ports/refresh-token.port";
import {
  SESSION_MANAGEMENT_REPOSITORY,
  type SessionManagementRepository,
} from "../ports/session-management-repository.port";

export interface LogoutCommand {
  readonly rawRefreshToken: string;
  readonly client: AuthClientContext;
}

@Injectable()
export class LogoutService {
  constructor(
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: RefreshTokenService,
    @Inject(SESSION_MANAGEMENT_REPOSITORY)
    private readonly sessionManagementRepository: SessionManagementRepository,
    @Inject(CLOCK)
    private readonly clock: Clock,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    const presentedToken = this.refreshTokenService.parseAndHash(
      command.rawRefreshToken,
    );

    if (!presentedToken) {
      return;
    }

    await this.sessionManagementRepository.logoutByRefreshCredential({
      tokenId: presentedToken.tokenId,
      tokenHash: presentedToken.tokenHash,
      occurredAt: this.clock.now(),
      client: command.client,
    });
  }
}
