import { randomBytes } from "node:crypto";
import { googleCalendarJson } from "./client";
import { resolveCalendarId } from "./calendarId";

export interface UpdateEventInput {
  calendarId?: string;
  defaultCalendarId?: string | null;
  eventId: string;
  summary?: string;
  description?: string;
  start?: { dateTime: string; timeZone: string } | { date: string };
  end?: { dateTime: string; timeZone: string } | { date: string };
  attendees?: string[];
  add_google_meet?: boolean;
}

export async function updateCalendarEvent(accessToken: string, input: UpdateEventInput) {
  const calId = encodeURIComponent(
    resolveCalendarId(input.calendarId, input.defaultCalendarId ?? undefined)
  );
  const eid = encodeURIComponent(input.eventId);

  const body: Record<string, unknown> = {};
  if (input.summary !== undefined) body.summary = input.summary;
  if (input.description !== undefined) body.description = input.description;
  if (input.start) body.start = input.start;
  if (input.end) body.end = input.end;
  if (input.attendees?.length) {
    body.attendees = input.attendees.map((email) => ({ email }));
  }
  if (input.add_google_meet) {
    body.conferenceData = {
      createRequest: {
        requestId: randomBytes(16).toString("hex"),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const q = input.add_google_meet ? "?conferenceDataVersion=1" : "";

  const result = await googleCalendarJson<Record<string, unknown>>(
    accessToken,
    `/calendars/${calId}/events/${eid}${q}`,
    { method: "PATCH", body: JSON.stringify(body) }
  );

  if (!result.ok) {
    return { ok: false as const, error: { status: result.status, message: result.message } };
  }

  return {
    ok: true as const,
    event: {
      id: result.data.id,
      htmlLink: result.data.htmlLink,
      hangoutLink: result.data.hangoutLink,
      start: result.data.start,
      end: result.data.end,
      summary: result.data.summary,
    },
  };
}
