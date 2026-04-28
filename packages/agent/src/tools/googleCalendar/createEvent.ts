import { randomBytes } from "node:crypto";
import { googleCalendarJson } from "./client";
import { resolveCalendarId } from "./calendarId";

export interface CreateEventInput {
  calendarId?: string;
  defaultCalendarId?: string | null;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string } | { date: string };
  end: { dateTime: string; timeZone: string } | { date: string };
  attendees?: string[];
  add_google_meet?: boolean;
}

export async function createCalendarEvent(accessToken: string, input: CreateEventInput) {
  const calId = encodeURIComponent(
    resolveCalendarId(input.calendarId, input.defaultCalendarId ?? undefined)
  );

  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description ?? "",
    start: input.start,
    end: input.end,
  };

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
    `/calendars/${calId}/events${q}`,
    { method: "POST", body: JSON.stringify(body) }
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
