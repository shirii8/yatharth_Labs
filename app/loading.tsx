/**
 * Shown the moment a link or button is pressed, while the next page is fetched,
 * so a slow connection never looks like a frozen screen. Deliberately quiet:
 * one line, no empty sheet flashing between pages.
 */
export default function Loading() {
  return (
    <p
      role="status"
      aria-live="polite"
      style={{
        margin: 0,
        padding: "40vh 16px 0",
        textAlign: "center",
        fontFamily: "var(--font-serif)",
        fontStyle: "italic",
        fontSize: 20,
      }}
    >
      One moment, opening the page…
    </p>
  );
}
