import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "node:crypto";
import { googleOAuthScopeParam } from "@/lib/google/oauthScopes";

function redirectUri(origin: string): string {
  const fixed = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (fixed) return fixed;
  return `${origin}/api/integrations/google/callback`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "Google OAuth not configured" },
      { status: 500 }
    );
  }

  const { origin } = new URL(request.url);
  const state = randomBytes(16).toString("hex");
  const rd = redirectUri(origin);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: rd,
    response_type: "code",
    scope: googleOAuthScopeParam(),
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );

  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
