import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().int().positive().default(10),
  SEED_ADMIN_EMAIL: z.string().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
});

/** Validated application configuration. Fails fast at boot when required variables are missing. */
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  FRONTEND_URLS: parsed.data.FRONTEND_URL.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  COOKIE_SECURE_BOOL: parsed.data.COOKIE_SECURE === "true",
  IS_TEST: parsed.data.NODE_ENV === "test",
  IS_PROD: parsed.data.NODE_ENV === "production",
} as const;
