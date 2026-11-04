/**
 * Outgoing messages sit behind this interface. The brief says to mock messages,
 * so the default provider records messages instead of sending them. A real SMS
 * or WhatsApp provider is another class with the same two methods.
 */

export type SmsStatus = "SENT" | "DELIVERED" | "FAILED";

export interface SmsResult {
  messageId: string | null;
  status: SmsStatus;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<SmsResult>;
}

export interface SentMessage {
  to: string;
  body: string;
  at: Date;
  messageId: string;
}

/** Keeps messages in memory and reports them delivered. Never logs the full number. */
export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";
  readonly outbox: SentMessage[] = [];
  private counter = 0;

  async send(to: string, body: string): Promise<SmsResult> {
    this.counter += 1;
    const messageId = `mock-${Date.now()}-${this.counter}`;
    this.outbox.push({ to, body, at: new Date(), messageId });
    if (process.env.NODE_ENV === "development") {
      console.info(`[mock sms] to ••••${to.slice(-4)}: ${body}`);
    }
    return { messageId, status: "DELIVERED" };
  }
}

let shared: SmsProvider | undefined;

export function smsProvider(): SmsProvider {
  shared ??= new MockSmsProvider();
  return shared;
}
