/** Small formatting helpers for patient screens. Times are shown in India time. */

const IST = "Asia/Kolkata";

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

/** "this morning", "yesterday" or "on 12 Aug": how a person would say it. */
export function signedWhen(date: Date | null, now: Date = new Date()): string {
  if (!date) return "recently";
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: IST });
  const hour = Number(
    date.toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: IST }),
  );
  if (day(date) === day(now)) {
    return hour < 12 ? "this morning" : hour < 17 ? "this afternoon" : "this evening";
  }
  const yesterday = new Date(now.getTime() - 24 * 60 * 60_000);
  if (day(date) === day(yesterday)) return "yesterday";
  return `on ${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST })}`;
}

export function dateTime(date: Date): string {
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: IST,
  });
}

export function clock(date: Date): string {
  return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: IST });
}
