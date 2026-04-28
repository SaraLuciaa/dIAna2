import type { DbClient } from "../client";
import { decrypt, encrypt } from "../crypto";

/** Single row per user for Google OAuth (Calendar + future Workspace APIs). */
export const GOOGLE_INTEGRATION_PROVIDER = "google";

const TOKEN_SKEW_MS = 120_000;

export interface GoogleOAuthTokenBlob {
  access_token: string;
  refresh_token: string;
  /** ISO 8601 instant when access_token expires */
  expires_at: string;
  scope?: string;
}

export function serializeGoogleTokenBlob(blob: GoogleOAuthTokenBlob): string {
  return JSON.stringify(blob);
}

export function parseGoogleTokenBlob(plaintext: string): GoogleOAuthTokenBlob | null {
  try {
    const o = JSON.parse(plaintext) as Record<string, unknown>;
    if (
      typeof o.access_token === "string" &&
      typeof o.refresh_token === "string" &&
      typeof o.expires_at === "string"
    ) {
      return {
        access_token: o.access_token,
        refresh_token: o.refresh_token,
        expires_at: o.expires_at,
        scope: typeof o.scope === "string" ? o.scope : undefined,
      };
    }
  } catch {
    /* invalid */
  }
  return null;
}

async function markGoogleIntegrationExpired(db: DbClient, userId: string) {
  await db
    .from("user_integrations")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("provider", GOOGLE_INTEGRATION_PROVIDER);
}

async function persistGoogleBlob(
  db: DbClient,
  userId: string,
  blob: GoogleOAuthTokenBlob
) {
  const encrypted = encrypt(serializeGoogleTokenBlob(blob));
  const { error } = await db
    .from("user_integrations")
    .update({ encrypted_tokens: encrypted, status: "active" })
    .eq("user_id", userId)
    .eq("provider", GOOGLE_INTEGRATION_PROVIDER);
  if (error) throw error;
}

async function refreshGoogleAccessToken(
  db: DbClient,
  userId: string,
  blob: GoogleOAuthTokenBlob
): Promise<GoogleOAuthTokenBlob | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[google] missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET");
    return null;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: blob.refresh_token,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await res.json()) as Record<string, unknown>;

  if (!res.ok || data.error) {
    const code = data.error;
    if (code === "invalid_grant") {
      await markGoogleIntegrationExpired(db, userId);
    }
    console.error("[google] token refresh failed", { status: res.status, code });
    return null;
  }

  const access_token = data.access_token as string | undefined;
  const expires_in = Number(data.expires_in ?? 3600);
  if (!access_token) return null;

  const newBlob: GoogleOAuthTokenBlob = {
    access_token,
    refresh_token:
      typeof data.refresh_token === "string" ? (data.refresh_token as string) : blob.refresh_token,
    expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
    scope: typeof data.scope === "string" ? (data.scope as string) : blob.scope,
  };

  await persistGoogleBlob(db, userId, newBlob);
  return newBlob;
}

/**
 * Returns a valid Google access token for Calendar API, refreshing and persisting when needed.
 * Never logs token values.
 */
export async function getValidGoogleAccessToken(
  db: DbClient,
  userId: string
): Promise<string | null> {
  const { data: row, error } = await db
    .from("user_integrations")
    .select("encrypted_tokens, status")
    .eq("user_id", userId)
    .eq("provider", GOOGLE_INTEGRATION_PROVIDER)
    .eq("status", "active")
    .maybeSingle();

  if (error || !row?.encrypted_tokens) return null;

  let plaintext: string;
  try {
    plaintext = decrypt(row.encrypted_tokens as string);
  } catch (e) {
    console.error("[google] decrypt failed for user", userId, e);
    return null;
  }

  const blob = parseGoogleTokenBlob(plaintext);
  if (!blob?.access_token || !blob.refresh_token) return null;

  const expires = Date.parse(blob.expires_at);
  if (Number.isNaN(expires)) return null;

  if (expires > Date.now() + TOKEN_SKEW_MS) {
    return blob.access_token;
  }

  const refreshed = await refreshGoogleAccessToken(db, userId, blob);
  return refreshed?.access_token ?? null;
}
