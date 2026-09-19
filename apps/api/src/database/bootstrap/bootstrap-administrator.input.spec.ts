import { Readable } from "node:stream";
import { BootstrapAdministratorInputError } from "./bootstrap-administrator.error";
import {
  BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE,
  BOOTSTRAP_ADMIN_PASSWORD_POLICY,
  parseBootstrapAdministratorInput,
  readBootstrapAdministratorPassword,
} from "./bootstrap-administrator.input";

const VALID_PASSWORD = "correct horse battery staple";

describe("bootstrap administrator input", () => {
  it("normalizes the email and surrounding display-name whitespace", () => {
    const input = parseBootstrapAdministratorInput(
      {
        [BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL]: " Admin@Example.COM ",
        [BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.DISPLAY_NAME]:
          " System Administrator ",
      },
      VALID_PASSWORD,
    );

    expect(input).toEqual({
      email: "admin@example.com",
      displayName: "System Administrator",
      password: VALID_PASSWORD,
    });
  });

  it("rejects missing or invalid environment input without echoing values", () => {
    expect(() =>
      parseBootstrapAdministratorInput(
        {
          [BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL]: "not-an-email",
          [BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.DISPLAY_NAME]: " ",
        },
        VALID_PASSWORD,
      ),
    ).toThrow(BootstrapAdministratorInputError);
  });

  it("rejects a password below the bootstrap minimum", () => {
    expect(() =>
      parseBootstrapAdministratorInput(
        {
          [BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL]: "admin@example.com",
          [BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.DISPLAY_NAME]:
            "System Administrator",
        },
        "too-short",
      ),
    ).toThrow(
      `The password must contain at least ${BOOTSTRAP_ADMIN_PASSWORD_POLICY.MIN_LENGTH} characters`,
    );
  });

  it("removes one terminal line ending without trimming password spaces", async () => {
    const password = await readBootstrapAdministratorPassword(
      Readable.from(["  password with spaces  \r\n"]),
    );

    expect(password).toBe("  password with spaces  ");
  });

  it("rejects oversized standard input", async () => {
    const oversizedInput = "x".repeat(
      BOOTSTRAP_ADMIN_PASSWORD_POLICY.MAX_STDIN_BYTES + 1,
    );

    await expect(
      readBootstrapAdministratorPassword(Readable.from([oversizedInput])),
    ).rejects.toThrow(BootstrapAdministratorInputError);
  });

  it("rejects direct terminal input", async () => {
    const terminalInput = Readable.from([]) as Readable & { isTTY?: boolean };
    terminalInput.isTTY = true;

    await expect(
      readBootstrapAdministratorPassword(terminalInput),
    ).rejects.toThrow("interactive terminal input is disabled");
  });
});
