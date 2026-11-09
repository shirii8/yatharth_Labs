import type { AiFacts } from "./checker";
import type { SummaryWriter } from "./provider";
import { SYSTEM, TRANSLATE_SYSTEM } from "./prompts";

/**
 * Google Gemini behind the same interface as Claude, called over plain HTTPS
 * (no extra package, so pages stay light). Same rules, same facts, same
 * checker afterwards: a wrong, cut-off or declined answer is thrown away and
 * the patient gets the approved template wording instead.
 *
 * The key goes in a header, never in the address, so it cannot end up in a
 * log line. On Google's free tier, prompts may be used to improve Google's
 * products; this app sends only de-identified values (assumption A34).
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Stops that mean the model would not answer; the patient sees the template. */
const DECLINED = new Set([
  "SAFETY",
  "RECITATION",
  "BLOCKLIST",
  "PROHIBITED_CONTENT",
  "SPII",
  "LANGUAGE",
  "OTHER",
]);

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

export class GeminiSummaryWriter implements SummaryWriter {
  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly timeoutSeconds: number,
  ) {}

  private async ask(system: string, content: string): Promise<string> {
    const response = await fetch(`${BASE}/${encodeURIComponent(this.model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      // No retries: if the AI is slow, the patient gets the rule lines straight away.
      signal: AbortSignal.timeout(this.timeoutSeconds * 1000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: content }] }],
        generationConfig: {
          maxOutputTokens: 2048,
          // A short paragraph needs little thinking (Gemini 3 and later only).
          ...(this.model.startsWith("gemini-2")
            ? {}
            : { thinkingConfig: { thinkingLevel: "LOW" } }),
        },
      }),
    });
    if (!response.ok) throw new Error(`Gemini answered ${response.status}.`);

    const data = (await response.json()) as GeminiResponse;
    if (data.promptFeedback?.blockReason) throw new Error("The model declined.");
    const candidate = data.candidates?.[0];
    const reason = candidate?.finishReason ?? "";
    if (reason === "MAX_TOKENS") throw new Error("The answer was cut off.");
    if (DECLINED.has(reason)) throw new Error("The model declined.");

    const text = (candidate?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) throw new Error("The model declined.");
    return text;
  }

  write(facts: AiFacts): Promise<string> {
    return this.ask(SYSTEM, JSON.stringify(facts, null, 2));
  }

  translate(text: string, language: "TE" | "HI"): Promise<string> {
    const name = language === "TE" ? "Telugu" : "Hindi";
    return this.ask(TRANSLATE_SYSTEM, `Language: ${name}\n\nSentence:\n${text}`);
  }
}
