/**
 * The SMS that carries a report link. It never contains a result, a flag or the
 * word "critical": anyone can read a phone's lock screen.
 */
export function linkMessage(input: { patientName: string; testName: string; url: string }): string {
  const lab = process.env.NEXT_PUBLIC_LAB_NAME || "Your lab";
  const firstName = input.patientName.split(" ")[0] ?? input.patientName;
  return `${lab}: ${firstName}'s ${input.testName} report is ready. Open it here: ${input.url} The link works for 72 hours. Please do not share it.`;
}
