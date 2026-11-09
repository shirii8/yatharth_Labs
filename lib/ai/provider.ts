import Anthropic from "@anthropic-ai/sdk";
import { env, type Env } from "@/lib/env";
import type { AiFacts } from "./checker";
import { GeminiSummaryWriter } from "./gemini";
import { SYSTEM, TRANSLATE_SYSTEM } from "./prompts";

/**
 * The AI behind one small interface: Claude or Gemini today, and another
 * model (for example an India-hosted one) can replace either. It receives
 * only the rule's findings: test name, analyte names, values, units, printed
 * ranges and rule words.
 * Never a name, phone number, age or order ID.
 */

export const PROMPT_VERSION = "summary-v1";

export interface SummaryWriter {
  readonly model: string;
  write(facts: AiFacts): Promise<string>;
  translate(text: string, language: "TE" | "HI"): Promise<string>;
}

function textOf(message: { content: { type: string; text?: string }[] }): string {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();
}

export class ClaudeSummaryWriter implements SummaryWriter {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
    timeoutSeconds: number,
  ) {
    // No retries: if the AI is slow, the patient gets the rule lines straight away.
    this.client = new Anthropic({ apiKey, timeout: timeoutSeconds * 1000, maxRetries: 0 });
  }

  private async ask(system: string, content: string): Promise<string> {
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: 2000,
      // A short paragraph needs little thinking.
      output_config: { effort: "low" },
      // If the model declines, the API retries on a fallback model in the same call.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") throw new Error("The model declined.");
    if (response.stop_reason === "max_tokens") throw new Error("The answer was cut off.");
    return textOf(response);
  }

  write(facts: AiFacts): Promise<string> {
    return this.ask(SYSTEM, JSON.stringify(facts, null, 2));
  }

  translate(text: string, language: "TE" | "HI"): Promise<string> {
    const name = language === "TE" ? "Telugu" : "Hindi";
    return this.ask(TRANSLATE_SYSTEM, `Language: ${name}\n\nSentence:\n${text}`);
  }
}

type AiConfig = Pick<Env, "AI_PROVIDER" | "AI_MODEL" | "AI_TIMEOUT_SECONDS"> & {
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
};

/**
 * Which model writes the paragraph. "auto" (the default) uses Claude when its
 * key is set, otherwise Gemini when its key is set, otherwise none. With no
 * writer, patients get the approved template wording: nothing breaks.
 */
export function chooseWriter(config: AiConfig): SummaryWriter | null {
  const provider =
    config.AI_PROVIDER === "auto"
      ? config.ANTHROPIC_API_KEY
        ? "anthropic"
        : config.GEMINI_API_KEY
          ? "gemini"
          : "none"
      : config.AI_PROVIDER;
  if (provider === "anthropic" && config.ANTHROPIC_API_KEY) {
    return new ClaudeSummaryWriter(
      config.ANTHROPIC_API_KEY,
      config.AI_MODEL || "claude-opus-5-5",
      config.AI_TIMEOUT_SECONDS,
    );
  }
  if (provider === "gemini" && config.GEMINI_API_KEY) {
    return new GeminiSummaryWriter(
      config.GEMINI_API_KEY,
      config.AI_MODEL || "gemini-3.5-flash-lite",
      config.AI_TIMEOUT_SECONDS,
    );
  }
  return null;
}

/** The configured writer, or null when AI is off or has no key: rule lines only. */
export function summaryWriter(): SummaryWriter | null {
  return chooseWriter(env());
}
