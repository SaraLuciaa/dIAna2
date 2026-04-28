import { googleCalendarJson } from "./client";
import { resolveCalendarId } from "./calendarId";

export async function deleteCalendarEvent(
  accessToken: string,
  params: {
    calendarId?: string;
    defaultCalendarId?: string | null;
    eventId: string;
  }
) {
  const calId = encodeURIComponent(
    resolveCalendarId(params.calendarId, params.defaultCalendarId ?? undefined)
  );
  const eid = encodeURIComponent(params.eventId);

  const result = await googleCalendarJson<unknown>(
    accessToken,
    `/calendars/${calId}/events/${eid}`,
    { method: "DELETE" }
  );

  if (!result.ok) {
    return { ok: false as const, error: { status: result.status, message: result.message } };
  }

  return { ok: true as const, deleted: true, eventId: params.eventId };
}
