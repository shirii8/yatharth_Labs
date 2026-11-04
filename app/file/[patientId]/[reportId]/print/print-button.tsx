"use client";

/** Opens the phone's or computer's print dialog. Hidden on the printed page itself. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        minHeight: 56,
        padding: "8px 20px",
        border: 0,
        borderRadius: 12,
        background: "var(--green)",
        color: "var(--on-green)",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
