import { z } from "zod";

/**
 * Server configuration, read once and checked with Zod.
 * A missing or short secret stops the app at start-up with a clear message,
 * instead of failing later in the middle of a patient's sign-in.
 */
const secret = z.string().min(32, "must be at least 32 characters");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: secret,
  PHONE_HASH_KEY: secret,
  PHONE_ENC_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64 encoded"),
  TOKEN_HASH_KEY: secret,
  APP_BASE_URL: z.string().url(),
  NEXT_PUBLIC_LAB_PHONE: z.string().default("+910000000000"),
  SMS_PROVIDER: z.enum(["mock"]).default("mock"),
  AI_PROVIDER: z.enum(["auto", "anthropic", "gemini", "none"]).default("auto"),
  ANTHROPIC_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
  AI_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(30).default(8),
  DEMO_MODE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  DEMO_OTP: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`);
    throw new Error(`Configuration problem. Check your .env file:\n- ${problems.join("\n- ")}`);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.DEMO_MODE && !parsed.data.DEMO_OTP) {
    throw new Error("DEMO_MODE is on but DEMO_OTP is not set.");
  }
  cached = parsed.data;
  return cached;
}
