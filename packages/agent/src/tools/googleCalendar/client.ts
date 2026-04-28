const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export type GoogleCalendarResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: string; message: string };

function summarizeGoogleError(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const e = (body as { error?: { message?: string; errors?: { reason?: string }[] } }).error;
    if (e?.message) return e.message;
    if (e?.errors?.[0]?.reason) return e.errors[0].reason ?? "Unknown error";
  }
  return "Google Calendar API error";
}

export async function googleCalendarJson<T>(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<GoogleCalendarResult<T>> {
  const url = path.startsWith("http") ? path : `${CALENDAR_API}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }

  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: res.status === 429 ? "rate_limited" : undefined,
      message: summarizeGoogleError(parsed),
    };
  }

  return { ok: true, data: parsed as T };
}
