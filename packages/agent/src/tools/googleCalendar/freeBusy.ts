import { googleCalendarJson } from "./client";

export interface FreeBusyRequest {
  timeMin: string;
  timeMax: string;
  calendarIds: string[];
}

export async function queryFreeBusy(accessToken: string, req: FreeBusyRequest) {
  const body = {
    timeMin: req.timeMin,
    timeMax: req.timeMax,
    items: req.calendarIds.map((id) => ({ id })),
  };

  const result = await googleCalendarJson<{
    calendars?: Record<
      string,
      { busy?: { start: string; end: string }[]; errors?: { reason?: string }[] }
    >;
  }>(accessToken, "/freeBusy", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!result.ok) {
    return {
      ok: false as const,
      error: { status: result.status, message: result.message },
    };
  }

  const calendars: Record<string, { busy: { start: string; end: string }[] }> = {};
  for (const [id, v] of Object.entries(result.data.calendars ?? {})) {
    calendars[id] = { busy: v.busy ?? [] };
  }

  return { ok: true as const, calendars };
}
