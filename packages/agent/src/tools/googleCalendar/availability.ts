import { queryFreeBusy } from "./freeBusy";
import { resolveCalendarId } from "./calendarId";

function parseIso(s: string): number {
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new Error(`Invalid ISO datetime: ${s}`);
  return t;
}

/** Merge busy intervals and return gaps of at least slotMinutes within [timeMin, timeMax]. */
export async function computeAvailability(
  accessToken: string,
  params: {
    calendarIds?: string[];
    defaultCalendarId?: string | null;
    timeMin: string;
    timeMax: string;
    slotMinutes?: number;
  }
) {
  const slotMs = (params.slotMinutes ?? 30) * 60_000;
  const windowStart = parseIso(params.timeMin);
  const windowEnd = parseIso(params.timeMax);
  if (windowEnd <= windowStart) {
    return { ok: false as const, error: { message: "timeMax must be after timeMin" } };
  }

  const ids =
    params.calendarIds?.length && params.calendarIds.length > 0
      ? params.calendarIds
      : [resolveCalendarId(undefined, params.defaultCalendarId)];

  const fb = await queryFreeBusy(accessToken, {
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    calendarIds: ids,
  });
  if (!fb.ok) return fb;

  const busy: { start: number; end: number }[] = [];
  for (const cal of Object.values(fb.calendars)) {
    for (const b of cal.busy) {
      busy.push({ start: parseIso(b.start), end: parseIso(b.end) });
    }
  }
  busy.sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [];
  for (const b of busy) {
    const last = merged[merged.length - 1];
    if (!last || b.start > last.end) merged.push({ ...b });
    else last.end = Math.max(last.end, b.end);
  }

  const free: { start: string; end: string }[] = [];
  let cursor = windowStart;
  for (const b of merged) {
    if (b.start > cursor + slotMs) {
      free.push({
        start: new Date(cursor).toISOString(),
        end: new Date(Math.min(b.start, windowEnd)).toISOString(),
      });
    }
    cursor = Math.max(cursor, b.end);
  }
  if (windowEnd > cursor + slotMs) {
    free.push({
      start: new Date(cursor).toISOString(),
      end: new Date(windowEnd).toISOString(),
    });
  }

  return {
    ok: true as const,
    calendars: ids,
    freeSlots: free.filter((s) => parseIso(s.end) - parseIso(s.start) >= slotMs),
  };
}
