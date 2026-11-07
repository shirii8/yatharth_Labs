/**
 * Shown the moment a link or button is pressed, while the next page is fetched:
 * a slim bar moving along the top, so a slow connection never looks frozen.
 * Screen readers hear "Opening the page".
 */
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <span className="visually-hidden">Opening the page…</span>
      <span
        aria-hidden="true"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "var(--green)",
          transformOrigin: "left",
          animation: "loading-bar 1.6s var(--ease-paper) infinite",
          zIndex: 50,
        }}
      />
      <style>{`@keyframes loading-bar { 0% { transform: scaleX(0); } 60% { transform: scaleX(0.8); } 100% { transform: scaleX(1); opacity: 0; } }`}</style>
    </div>
  );
}
