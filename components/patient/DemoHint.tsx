/**
 * Shown only when DEMO_MODE is on: SMS is simulated, so reviewers need the
 * demo numbers and the fixed code. Never shown in a real deployment.
 */
export function DemoHint({ codeOnly = false }: { codeOnly?: boolean }) {
  if (process.env.DEMO_MODE !== "true" || !process.env.DEMO_OTP) return null;
  return (
    <p
      style={{
        margin: 0,
        padding: "12px 16px",
        border: "1.5px solid var(--ink)",
        borderRadius: 12,
        background: "var(--sand)",
        fontSize: "0.85em",
      }}
    >
      <strong>Demo only.</strong> SMS is simulated, so no text message arrives.{" "}
      {codeOnly
        ? `Type the demo code ${process.env.DEMO_OTP}.`
        : `Use +91 90000 00001, 00002 or 00003, then the code ${process.env.DEMO_OTP}. Other numbers get no code.`}
    </p>
  );
}
