export function resolveCalendarId(
  explicit: string | undefined,
  defaultFromProfile: string | null | undefined
): string {
  if (explicit && explicit.trim()) return explicit.trim();
  if (defaultFromProfile && defaultFromProfile.trim()) return defaultFromProfile.trim();
  return "primary";
}
