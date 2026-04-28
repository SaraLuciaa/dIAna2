import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createServerClient,
  revokeIntegration,
  decrypt,
  GOOGLE_INTEGRATION_PROVIDER,
} from "@agents/db";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServerClient();

  const { data: row } = await db
    .from("user_integrations")
    .select("encrypted_tokens")
    .eq("user_id", user.id)
    .eq("provider", GOOGLE_INTEGRATION_PROVIDER)
    .eq("status", "active")
    .maybeSingle();

  if (row?.encrypted_tokens) {
    try {
      const raw = decrypt(row.encrypted_tokens as string);
      const parsed = JSON.parse(raw) as { refresh_token?: string };
      if (typeof parsed.refresh_token === "string") {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: parsed.refresh_token }),
        }).catch(() => {});
      }
    } catch {
      /* ignore revoke failures */
    }
  }

  await revokeIntegration(db, user.id, GOOGLE_INTEGRATION_PROVIDER);

  return NextResponse.json({ ok: true });
}
