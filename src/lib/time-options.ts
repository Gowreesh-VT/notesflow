const STEP_MINUTES = 15;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Times of day for a picker, every 15 minutes from 00:00 to 23:45. A time that is not on that grid (such as 17:07
 * from quick add) is kept in its place, so the picker can always show the value a task already has.
 */
export function timeOptions(current?: string | null): string[] {
  const times: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += STEP_MINUTES) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    times.push(`${h}:${m}`);
  }
  if (current && CLOCK.test(current) && !times.includes(current)) {
    times.push(current);
    times.sort();
  }
  return times;
}
