import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import type { AiFacts } from "./checker";

/**
 * The AI behind one small interface, so another model (for example an
 * India-hosted one) can replace it. It receives only the rule's findings:
 * test name, analyte names, values, units, printed ranges and rule words.
 * Never a name, phone number, age or order ID.
 */

export const PROMPT_VERSION = "summary-v1";

export interface SummaryWriter {
  readonly model: string;
  write(facts: AiFacts): Promise<string>;
  translate(text: string, language: "TE" | "HI"): Promise<string>;
}

const SYSTEM = `You write the "In short" paragraph on a lab report page for patients in coastal Andhra Pradesh, many of them elderly.

Rules:
- Two or three short sentences, plain English, warm and calm.
- Use only the facts given. Mention every result whose flag is LOW or HIGH, using exactly the rule words given for it (for example "a little low" or "much higher than usual"). You may give its value and printed range.
- Do not mention results marked USUAL by name, except to say how many are in the usual range.
- Never diagnose, name a disease or condition, suggest a cause, or advise on medicine, diet or treatment.
- Never use the words urgent, critical, abnormal, serious, risk, normal, or say there is nothing to worry about.
- End with: "Your doctor will explain what this means for you."
- Reply with the paragraph only.`;

const TRANSLATE_SYSTEM = `Translate the patient-facing sentence into the requested language for elderly readers in coastal Andhra Pradesh. Keep every {placeholder} exactly as written, keep numbers unchanged, use plain everyday words, and keep the calm tone. Reply with the translation only.`;

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

/** The configured writer, or null when AI is off or has no key: rule lines only. */
export function summaryWriter(): SummaryWriter | null {
  const config = env();
  if (config.AI_PROVIDER !== "anthropic" || !config.ANTHROPIC_API_KEY) return null;
  return new ClaudeSummaryWriter(
    config.ANTHROPIC_API_KEY,
    config.AI_MODEL || "claude-opus-5-5",
    config.AI_TIMEOUT_SECONDS,
  );
}
