import type { Readable } from "node:stream";
import { z } from "zod";
import { BootstrapAdministratorInputError } from "./bootstrap-administrator.error";

export const BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE = {
  EMAIL: "BOOTSTRAP_ADMIN_EMAIL",
  DISPLAY_NAME: "BOOTSTRAP_ADMIN_DISPLAY_NAME",
} as const;

export const BOOTSTRAP_ADMIN_PASSWORD_POLICY = {
  MIN_LENGTH: 15,
  MAX_LENGTH: 1_024,
  MAX_STDIN_BYTES: 4_096,
} as const;

const BLOCKED_DEFAULT_PASSWORDS = new Set([
  "admin",
  "administrator",
  "administrator123",
  "adminadminadmin",
  "changeme",
  "changemeplease",
  "letmein",
  "password",
  "password123",
  "qwerty",
  "welcome",
]);

const bootstrapAdministratorInputSchema = z.object({
  email: z
    .string({
      error: `${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL} is required`,
    })
    .trim()
    .min(1, `${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL} is required`)
    .max(254, `${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL} is too long`)
    .email(
      `${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL} must be a valid email`,
    )
    .transform((value) => value.toLowerCase()),
  displayName: z
    .string({
      error: `${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.DISPLAY_NAME} is required`,
    })
    .trim()
    .min(
      1,
      `${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.DISPLAY_NAME} cannot be blank`,
    )
    .max(
      200,
      `${BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.DISPLAY_NAME} is too long`,
    ),
  password: z
    .string({ error: "A password must be provided through standard input" })
    .min(
      BOOTSTRAP_ADMIN_PASSWORD_POLICY.MIN_LENGTH,
      `The password must contain at least ${BOOTSTRAP_ADMIN_PASSWORD_POLICY.MIN_LENGTH} characters`,
    )
    .max(
      BOOTSTRAP_ADMIN_PASSWORD_POLICY.MAX_LENGTH,
      `The password must contain at most ${BOOTSTRAP_ADMIN_PASSWORD_POLICY.MAX_LENGTH} characters`,
    )
    .refine(
      (value) =>
        !BLOCKED_DEFAULT_PASSWORDS.has(value.normalize("NFKC").toLowerCase()),
      "A known default password is not allowed",
    ),
});

export interface BootstrapAdministratorInput {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
}

export function parseBootstrapAdministratorInput(
  environment: NodeJS.ProcessEnv,
  password: string,
): BootstrapAdministratorInput {
  const result = bootstrapAdministratorInputSchema.safeParse({
    email: environment[BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.EMAIL],
    displayName: environment[BOOTSTRAP_ADMIN_ENVIRONMENT_VARIABLE.DISPLAY_NAME],
    password,
  });

  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message);
    throw new BootstrapAdministratorInputError(
      [...new Set(messages)].join("; "),
    );
  }

  return result.data;
}

export async function readBootstrapAdministratorPassword(
  input: Readable,
): Promise<string> {
  const terminalInput = input as Readable & { readonly isTTY?: boolean };

  if (terminalInput.isTTY === true) {
    throw new BootstrapAdministratorInputError(
      "The password must be piped through standard input; interactive terminal input is disabled to prevent password echo.",
    );
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of input) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    totalBytes += buffer.byteLength;

    if (totalBytes > BOOTSTRAP_ADMIN_PASSWORD_POLICY.MAX_STDIN_BYTES) {
      throw new BootstrapAdministratorInputError(
        "The password input exceeds the allowed size.",
      );
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks)
    .toString("utf8")
    .replace(/\r?\n$/, "");
}
