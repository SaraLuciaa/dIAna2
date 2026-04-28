import { googleCalendarJson } from "./client";
import { resolveCalendarId } from "./calendarId";

export async function listEvents(
  accessToken: string,
  params: {
    calendarId?: string;
    defaultCalendarId?: string | null;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
  }
) {
  const calId = encodeURIComponent(
    resolveCalendarId(params.calendarId, params.defaultCalendarId ?? undefined)
  );
  const q = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: String(Math.min(params.maxResults ?? 50, 250)),
  });
  if (params.timeMin) q.set("timeMin", params.timeMin);
  if (params.timeMax) q.set("timeMax", params.timeMax);

  const result = await googleCalendarJson<{ items?: Record<string, unknown>[] }>(
    accessToken,
    `/calendars/${calId}/events?${q.toString()}`
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error: { status: result.status, message: result.message },
    };
  }

  const items = (result.data.items ?? []).map((ev) => ({
    id: ev.id,
    summary: ev.summary,
    status: ev.status,
    htmlLink: ev.htmlLink,
    start: ev.start,
    end: ev.end,
    attendees: ev.attendees,
    hangoutLink: ev.hangoutLink,
  }));

  return { ok: true as const, events: items };
}
