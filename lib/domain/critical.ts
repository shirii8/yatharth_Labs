/**
 * Critical values. A critical report shows the patient no number, no summary
 * and no flag text, and creates a callback task for staff. AI is never involved.
 */

export interface CriticalLimits {
  criticalLow: number | null;
  criticalHigh: number | null;
}

/** True at or beyond either critical limit. Reaching a limit errs towards a phone call. */
export function isCritical(value: number, limits: CriticalLimits): boolean {
  if (limits.criticalLow !== null && value <= limits.criticalLow) return true;
  if (limits.criticalHigh !== null && value >= limits.criticalHigh) return true;
  return false;
}

/**
 * A report is critical if any result is critical by our rule, or if the LIS
 * export marked it critical. Either source alone is enough.
 */
export function reportHasCritical(resultCritical: boolean[], lisMarkedCritical: boolean): boolean {
  return lisMarkedCritical || resultCritical.some(Boolean);
}
