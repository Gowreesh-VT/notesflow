/** Readable messages for Auth.js error codes (from ?error=… after a redirect, or signIn results). */
const AUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email already has an account that uses a different sign-in method. Sign in the way you did before.",
  CredentialsSignin: "Wrong email or password, or too many attempts. Try again in a few minutes.",
  AccessDenied: "Access was denied.",
  Configuration: "Sign-in is not available right now because the server is not fully set up yet.",
};

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  return AUTH_ERRORS[code] ?? "Could not sign in. Please try again.";
}
