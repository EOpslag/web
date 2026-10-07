/**
 * Unit availability shown on the site.
 *
 * Starts at TOTAL_UNITS - INITIAL_SOLD available. From LAUNCH_DAY on, every full week that has passed marks
 * WEEKLY_SOLD more units as sold (first step on 19 Oct 2026), never dropping below MIN_AVAILABLE.
 * Weeks are counted in calendar days in Europe/Amsterdam, so the result does not depend on the visitor's
 * timezone and is not shifted by the daylight-saving change on 25 Oct 2026.
 */
export const TOTAL_UNITS = 40;
export const INITIAL_SOLD = 4;
export const WEEKLY_SOLD = 2;
export const MIN_AVAILABLE = 3;
/** First day of the schedule: 12 October 2026 (Amsterdam), as a day number since the Unix epoch. */
const LAUNCH_DAY = Date.UTC(2026, 9, 12) / 86_400_000;

const amsterdamDayNumber = (date: Date): number => {
  const [year, month, day] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' })
    .format(date)
    .split('-')
    .map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
};

export const getUnitAvailability = (now: Date = new Date()) => {
  const fullWeeks = Math.max(0, Math.floor((amsterdamDayNumber(now) - LAUNCH_DAY) / 7));
  const soldUnits = Math.min(INITIAL_SOLD + fullWeeks * WEEKLY_SOLD, TOTAL_UNITS - MIN_AVAILABLE);
  return { totalUnits: TOTAL_UNITS, soldUnits, availableUnits: TOTAL_UNITS - soldUnits };
};
