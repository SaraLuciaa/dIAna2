import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createServerClient,
  upsertIntegration,
  encrypt,
  serializeGoogleTokenBlob,
} from "@agents/db";
import { googleOAuthScopeParam } from "@/lib/google/oauthScopes";

function redirectUri(origin: string): string {
  const fixed = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (fixed) return fixed;
  return `${origin}/api/integrations/google/callback`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/settings?google=error&reason=${encodeURIComponent(errorParam)}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieState = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("google_oauth_state="))
    ?.split("=")[1];

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(
      `${origin}/settings?google=error&reason=state_mismatch`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/settings?google=error&reason=no_code`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${origin}/settings?google=error&reason=server_config`
    );
  }

  const rd = redirectUri(origin);
  const tokenBody = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: rd,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });

  const tokenData = (await tokenRes.json()) as Record<string, unknown>;

  if (!tokenRes.ok || tokenData.error || !tokenData.access_token) {
    console.error("Google token exchange failed:", tokenData.error);
    return NextResponse.redirect(
      `${origin}/settings?google=error&reason=token_exchange`
    );
  }

  const access_token = tokenData.access_token as string;
  const refresh_token =
    typeof tokenData.refresh_token === "string"
      ? (tokenData.refresh_token as string)
      : "";

  if (!refresh_token) {
    console.error("Google OAuth: no refresh_token; user may need to revoke app and reconnect");
    return NextResponse.redirect(
      `${origin}/settings?google=error&reason=no_refresh_token`
    );
  }

  const expires_in = Number(tokenData.expires_in ?? 3600);
  const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

  const scopeStr =
    typeof tokenData.scope === "string"
      ? (tokenData.scope as string)
      : googleOAuthScopeParam();
  const scopes = scopeStr.split(/[\s,]+/).filter(Boolean);

  let accountEmail: string | null = null;
  try {
    const ui = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (ui.ok) {
      const info = (await ui.json()) as { email?: string };
      if (typeof info.email === "string") accountEmail = info.email;
    }
  } catch {
    /* optional */
  }

  const blob = serializeGoogleTokenBlob({
    access_token,
    refresh_token,
    expires_at,
    scope: scopeStr,
  });
  const encryptedToken = encrypt(blob);

  const db = createServerClient();
  await upsertIntegration(db, user.id, "google", scopes, encryptedToken, accountEmail);

  const response = NextResponse.redirect(`${origin}/settings?google=connected`);
  response.cookies.delete("google_oauth_state");
  return response;
}
