import type { Item } from "./types";

export const PUSH_OFFER_KEY = "notesflow:push-offer";

/** Whether any task has a reminder, which is the moment closed-app reminders become useful. */
export function hasReminder(items: Item[]): boolean {
  return items.some(
    (i) =>
      i.kind === "task" &&
      !i.template &&
      i.deletedAt === null &&
      ((i.reminders?.length ?? 0) > 0 || i.constantReminder === true),
  );
}

/** Whether to offer push reminders: the server supports them, the user is signed in, has a reminder, and this device is not set up or declined. */
export function shouldOfferPush(state: {
  pushAvailable: boolean;
  signedIn: boolean;
  supported: boolean;
  subscribed: boolean;
  dismissed: boolean;
  hasReminder: boolean;
}): boolean {
  return (
    state.pushAvailable &&
    state.signedIn &&
    state.supported &&
    !state.subscribed &&
    !state.dismissed &&
    state.hasReminder
  );
}

export type Phone = "ios" | "android" | "other";

export function detectPhone(userAgent: string, maxTouchPoints = 0): Phone {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) {
    return "ios";
  }
  return /Android/i.test(userAgent) ? "android" : "other";
}

/** Short steps for making closed-app reminders work on this kind of device. */
export function pushSteps(phone: Phone): string[] {
  if (phone === "ios") {
    return [
      "Tap the Share button in Safari and choose Add to Home Screen.",
      "Open Notesflow from your Home Screen.",
      "Come back to this message and tap Turn on.",
    ];
  }
  if (phone === "android") {
    return [
      "Tap Turn on and choose Allow when your phone asks.",
      "If you blocked notifications before, allow them in your browser's site settings.",
    ];
  }
  return ["Click Turn on and choose Allow when your browser asks."];
}
