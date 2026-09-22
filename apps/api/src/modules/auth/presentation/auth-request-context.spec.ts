import type { RequestWithId } from "../../../shared/http/request-id/request-id.types";
import { AUTH_CLIENT_METADATA_LIMIT } from "../domain/auth.constants";
import { createAuthClientContext } from "./auth-request-context";

describe("createAuthClientContext", () => {
  it("keeps only validated, bounded client metadata", () => {
    const userAgent = "a".repeat(
      AUTH_CLIENT_METADATA_LIMIT.USER_AGENT_LENGTH + 100,
    );
    const request = {
      requestId: "11111111-1111-4111-8111-111111111111",
      ip: "127.0.0.1",
      get: (header: string) =>
        header === "user-agent" ? `  ${userAgent}  ` : undefined,
    } as unknown as RequestWithId;

    expect(createAuthClientContext(request)).toEqual({
      requestId: request.requestId,
      ipAddress: "127.0.0.1",
      userAgent: "a".repeat(AUTH_CLIENT_METADATA_LIMIT.USER_AGENT_LENGTH),
    });
  });

  it("drops invalid or empty metadata", () => {
    const request = {
      requestId: "11111111-1111-4111-8111-111111111111",
      ip: "not-an-ip-address",
      get: () => "   ",
    } as unknown as RequestWithId;

    expect(createAuthClientContext(request)).toEqual({
      requestId: request.requestId,
      ipAddress: null,
      userAgent: null,
    });
  });
});
