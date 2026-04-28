import type { PendingConfirmation } from "@agents/types";

const GOOGLE_CALENDAR_CONFIRM_TOOLS = new Set([
  "google_calendar_create_event",
  "google_calendar_update_event",
  "google_calendar_delete_event",
]);

export function googleCalendarConfirmationExtras(
  toolId: string,
  args: Record<string, unknown>
): Pick<PendingConfirmation, "provider" | "action" | "payload"> | undefined {
  if (!GOOGLE_CALENDAR_CONFIRM_TOOLS.has(toolId)) return undefined;

  const action = toolId.replace("google_calendar_", "");
  const start = args.start as Record<string, unknown> | undefined;
  const tz =
    start && typeof start === "object" && typeof start.timeZone === "string"
      ? start.timeZone
      : undefined;

  return {
    provider: "google_calendar",
    action,
    payload: {
      title: args.summary,
      start: args.start,
      end: args.end,
      timezone: tz,
      attendees: args.attendees,
      add_google_meet: args.add_google_meet,
      event_id: args.eventId,
      calendar_id: args.calendarId,
    },
  };
}
