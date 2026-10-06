/** How far (px) a row must be dragged sideways before letting go counts as a swipe. */
export const SWIPE_THRESHOLD = 72;

/**
 * Whether a touch that moved by (dx, dy) is a sideways swipe on a row rather than a scroll: it must move mostly
 * horizontally and by more than a few pixels, so vertical scrolling is never captured.
 */
export function isSideways(dx: number, dy: number): boolean {
  return Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5;
}

/** What letting go of a swiped row does: right completes, left opens the row's actions, too short does nothing. */
export function swipeAction(dx: number): "complete" | "actions" | null {
  if (dx >= SWIPE_THRESHOLD) return "complete";
  if (dx <= -SWIPE_THRESHOLD) return "actions";
  return null;
}

/** The row's offset while dragging: follows the finger, then resists past the threshold so it never runs away. */
export function swipeOffset(dx: number): number {
  const limit = SWIPE_THRESHOLD * 1.5;
  if (Math.abs(dx) <= SWIPE_THRESHOLD) return dx;
  const extra = Math.abs(dx) - SWIPE_THRESHOLD;
  return Math.sign(dx) * Math.min(limit, SWIPE_THRESHOLD + extra * 0.3);
}
