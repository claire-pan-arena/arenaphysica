import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { getAccessTokenForAdmin } from "@/lib/google-service-account";
import { NextResponse } from "next/server";

async function getActiveOrgEmails(): Promise<Set<string> | null> {
  const token = await getAccessTokenForAdmin();
  if (!token) return null;

  const active = new Set<string>();
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      domain: "arena-ai.com",
      maxResults: "500",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;

    const data = await res.json();
    for (const user of data.users || []) {
      if (!user.suspended) {
        active.add((user.primaryEmail || "").toLowerCase());
      }
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);

  return active;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  // Try to get active org emails from Google Directory
  const activeEmails = await getActiveOrgEmails();

  // Get people already in team_members table
  const existing = await sql`SELECT email, name FROM team_members ORDER BY name`;
  const knownEmails = new Set(existing.map((m: any) => m.email));
  const people: { email: string; name: string }[] = existing.map((m: any) => ({
    email: m.email,
    name: m.name,
  }));

  // Also scan calendar attendees to discover org members
  const accessToken = (session as any).accessToken;
  if (accessToken) {
    try {
      const now = new Date();
      const lookBack = new Date(now);
      lookBack.setDate(now.getDate() - 30);
      const lookAhead = new Date(now);
      lookAhead.setDate(now.getDate() + 90);

      const params = new URLSearchParams({
        timeMin: lookBack.toISOString(),
        timeMax: lookAhead.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });
      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (calRes.ok) {
        const calData = await calRes.json();
        for (const event of calData.items || []) {
          for (const attendee of event.attendees || []) {
            const email = (attendee.email || "").toLowerCase();
            if (
              email.endsWith("@arena-ai.com") &&
              !email.includes("calendar.google.com") &&
              !knownEmails.has(email)
            ) {
              // Skip if we know this email is deactivated
              if (activeEmails && !activeEmails.has(email)) continue;

              knownEmails.add(email);
              const name = attendee.displayName || email.split("@")[0].split(".").map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
              people.push({ email, name });
            }
          }
        }
      }
    } catch {}
  }

  people.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ people });
}
