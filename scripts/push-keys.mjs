// Prints a new VAPID key pair and cron secret for push reminders. Paste them into your hosting provider's
// environment variables (and .env.local for local testing). Never commit them.
import { randomBytes } from "node:crypto";
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:you@example.com   # change to your email");
console.log(`CRON_SECRET=${randomBytes(24).toString("base64url")}`);
