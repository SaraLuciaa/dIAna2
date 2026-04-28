/** Least-privilege scopes for Calendar + Settings email display. */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

export function googleOAuthScopeParam(): string {
  return GOOGLE_OAUTH_SCOPES.join(" ");
}
