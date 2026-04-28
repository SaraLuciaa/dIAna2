import { googleCalendarJson } from "./client";

export interface CalendarListEntry {
  id?: string;
  summary?: string;
  primary?: boolean;
  timeZone?: string;
  accessRole?: string;
}

export async function listCalendars(accessToken: string) {
  const result = await googleCalendarJson<{ items?: CalendarListEntry[] }>(
    accessToken,
    "/users/me/calendarList?maxResults=250"
  );
  if (!result.ok) {
    return {
      ok: false as const,
      error: { status: result.status, message: result.message, code: result.code },
    };
  }
  const items = (result.data.items ?? []).map((c) => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary ?? false,
    timeZone: c.timeZone,
    accessRole: c.accessRole,
  }));
  return { ok: true as const, calendars: items };
}
