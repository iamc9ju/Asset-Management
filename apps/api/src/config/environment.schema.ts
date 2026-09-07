import { z } from "zod";

const portSchema = z.coerce.number().int().min(1).max(65_535);
//coerce พยายามแปลงค่าให้เป็น number

const httpUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    },
    { message: "must use http:// or https://" },
  ); //refine สร้าง validation rule เพิ่ม

const redisUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      const protocol = new URL(value).protocol;
      return protocol === "redis:" || protocol === "rediss:";
    },
    { message: "must use redis:// or rediss://" },
  );

const booleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

export const environmentSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    API_PORT: portSchema.default(3000),
    WEB_ORIGIN: httpUrlSchema,

    POSTGRES_HOST: z.string().trim().min(1),
    POSTGRES_PORT: portSchema.default(5432),
    POSTGRES_DB: z.string().trim().min(1),
    POSTGRES_USER: z.string().trim().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    PGSSLMODE: z
      .enum([
        "disable",
        "allow",
        "prefer",
        "require",
        "verify-ca",
        "verify-full",
        "no-verify",
      ])
      .optional(),

    REDIS_URL: redisUrlSchema,

    S3_ENDPOINT: httpUrlSchema,
    S3_REGION: z.string().trim().min(1),
    S3_ACCESS_KEY: z.string().trim().min(1),
    S3_SECRET_KEY: z.string().min(1),
    S3_BUCKET: z
      .string()
      .min(3)
      .max(63)
      .regex(
        /^[a-z0-9][a-z0-9.-]*[a-z0-9]$/,
        "must be a valid lowercase S3 bucket name",
      ),
    S3_FORCE_PATH_STYLE: booleanSchema.default(true),
  })
  .passthrough() //ถ้ามี Environment อื่นที่เราไมไ่ด้ประกาศไว้ก็ยังไม่ต้องลบทิ้ง
  .superRefine((environment, context) => {
    if (environment.NODE_ENV !== "production") {
      return;
    }

    const secrets = [
      ["POSTGRES_PASSWORD", environment.POSTGRES_PASSWORD],
      ["S3_SECRET_KEY", environment.S3_SECRET_KEY],
    ] as const;

    for (const [key, value] of secrets) {
      if (value === "change-me-in-local-env") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "must not use the development placeholder in production",
        });
      }
    }
  });

export type EnvironmentVariables = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const result = environmentSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".") || "environment";
        return `${path}: ${issue.message}`;
      })
      .join("; ");

    throw new Error(`Environment validation failed: ${details}`);
  }

  return result.data;
}
