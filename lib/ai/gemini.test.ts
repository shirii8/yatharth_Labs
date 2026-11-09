import { afterEach, describe, expect, it, vi } from "vitest";
import type { AiFacts } from "./checker";
import { GeminiSummaryWriter } from "./gemini";
import { chooseWriter, ClaudeSummaryWriter } from "./provider";

const facts = {
  test: "Lipid Profile",
  results: [],
} as unknown as AiFacts;

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ok = (text: string, finishReason = "STOP") => ({
  candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason }],
});

afterEach(() => vi.restoreAllMocks());

describe("Gemini writer", () => {
  it("sends the key in a header, never in the address, with the rules as the system instruction", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(ok("In short.")));
    const writer = new GeminiSummaryWriter("test-key", "gemini-3.5-flash-lite", 8);
    await writer.write(facts);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
    );
    expect(String(url)).not.toContain("test-key");
    expect((init!.headers as Record<string, string>)["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(String(init!.body));
    expect(body.systemInstruction.parts[0].text).toContain("In short");
    expect(body.contents[0].parts[0].text).toContain("Lipid Profile");
  });

  it("returns the paragraph text, joined and trimmed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply({
        candidates: [
          {
            content: { parts: [{ text: " Two results " }, { text: "are high. " }] },
            finishReason: "STOP",
          },
        ],
      }),
    );
    const writer = new GeminiSummaryWriter("k", "gemini-3.5-flash-lite", 8);
    await expect(writer.write(facts)).resolves.toBe("Two results are high.");
  });

  it("treats a cut-off answer as a failure, so the patient gets the template", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(ok("Two results", "MAX_TOKENS")));
    const writer = new GeminiSummaryWriter("k", "gemini-3.5-flash-lite", 8);
    await expect(writer.write(facts)).rejects.toThrow(/cut off/);
  });

  it("treats a safety stop or a blocked prompt as a decline", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply(ok("", "SAFETY")));
    const writer = new GeminiSummaryWriter("k", "gemini-3.5-flash-lite", 8);
    await expect(writer.write(facts)).rejects.toThrow(/declined/);

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      reply({ promptFeedback: { blockReason: "SAFETY" } }),
    );
    await expect(writer.write(facts)).rejects.toThrow(/declined/);
  });

  it("fails on an error status without putting the key in the message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply({ error: { message: "quota exceeded" } }, 429),
    );
    const writer = new GeminiSummaryWriter("secret-key", "gemini-3.5-flash-lite", 8);
    const error = await writer.write(facts).catch((e: Error) => e);
    expect(String(error)).toMatch(/429/);
    expect(String(error)).not.toContain("secret-key");
  });

  it("gives up after the timeout instead of keeping the patient waiting", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init!.signal!.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const writer = new GeminiSummaryWriter("k", "gemini-3.5-flash-lite", 1);
    await expect(writer.write(facts)).rejects.toThrow();
  }, 5000);
});

describe("Choosing the AI", () => {
  const base = { AI_TIMEOUT_SECONDS: 8, AI_MODEL: undefined };

  it("uses Gemini when it is chosen and has a key, with the free default model", () => {
    const writer = chooseWriter({ ...base, AI_PROVIDER: "gemini", GEMINI_API_KEY: "g" });
    expect(writer).toBeInstanceOf(GeminiSummaryWriter);
    expect(writer?.model).toBe("gemini-3.5-flash-lite");
  });

  it("uses Claude when it is chosen and has a key", () => {
    const writer = chooseWriter({ ...base, AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "a" });
    expect(writer).toBeInstanceOf(ClaudeSummaryWriter);
    expect(writer?.model).toBe("claude-opus-5-5");
  });

  it("on auto, picks whichever key is set, Claude first", () => {
    expect(chooseWriter({ ...base, AI_PROVIDER: "auto", GEMINI_API_KEY: "g" })).toBeInstanceOf(
      GeminiSummaryWriter,
    );
    expect(
      chooseWriter({ ...base, AI_PROVIDER: "auto", GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }),
    ).toBeInstanceOf(ClaudeSummaryWriter);
  });

  it("uses the other AI when the chosen one has no key, so an old setting cannot switch AI off", () => {
    const writer = chooseWriter({ ...base, AI_PROVIDER: "anthropic", GEMINI_API_KEY: "g" });
    expect(writer).toBeInstanceOf(GeminiSummaryWriter);
  });

  it("is off with no key or when turned off, so patients get the templates", () => {
    expect(chooseWriter({ ...base, AI_PROVIDER: "auto" })).toBeNull();
    expect(chooseWriter({ ...base, AI_PROVIDER: "gemini" })).toBeNull();
    expect(chooseWriter({ ...base, AI_PROVIDER: "none", GEMINI_API_KEY: "g" })).toBeNull();
  });

  it("uses AI_MODEL when it is set", () => {
    const writer = chooseWriter({
      ...base,
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "g",
      AI_MODEL: "gemini-3.8-flash",
    });
    expect(writer?.model).toBe("gemini-3.8-flash");
  });
});
