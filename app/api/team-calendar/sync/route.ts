import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function getAccessTokenForUser(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch {
    return null;
  }
}

const TRAVEL_KEYWORDS = /travel|flight|fly|hotel|visit|onsite|on-site|offsite|off-site|trip|airport/i;

function isLikelyTravel(event: any): { isTravelEvent: boolean; location: string } {
  const summary = event.summary || "";
  const location = event.location || "";

  // Has a physical location set
  if (location && !location.match(/^https?:\/\//)) {
    return { isTravelEvent: true, location };
  }

  // Title contains travel keywords
  if (TRAVEL_KEYWORDS.test(summary)) {
    return { isTravelEvent: true, location: location || summary };
  }

  // Multi-day all-day event (likely OOO or travel)
  if (event.start?.date && event.end?.date) {
    const start = new Date(event.start.date);
    const end = new Date(event.end.date);
    const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (days >= 2) {
      return { isTravelEvent: true, location: location || "OOO" };
    }
  }

  return { isTravelEvent: false, location: "" };
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const { weekStart, weeks } = await request.json();
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart required" }, { status: 400 });
  }

  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + (weeks || 2) * 7);

  const members = await sql`SELECT email, name, refresh_token FROM team_members WHERE refresh_token IS NOT NULL`;

  let synced = 0;
  let failed = 0;

  for (const member of members) {
    const accessToken = await getAccessTokenForUser(member.refresh_token);
    if (!accessToken) {
      failed++;
      continue;
    }

    try {
      const params = new URLSearchParams({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "100",
      });

      const calRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!calRes.ok) {
        failed++;
        continue;
      }

      const calData = await calRes.json();
      const events = calData.items || [];

      // Clear old synced entries for this user in this date range
      await sql`
        DELETE FROM team_calendar_entries
        WHERE user_email = ${member.email}
        AND source = 'google_calendar'
        AND date >= ${weekStart}
        AND date < ${end.toISOString().split("T")[0]}
      `;

      for (const event of events) {
        const { isTravelEvent, location } = isLikelyTravel(event);
        if (!isTravelEvent) continue;

        // Get the date(s) this event covers
        const eventStart = event.start?.dateTime
          ? new Date(event.start.dateTime)
          : event.start?.date
            ? new Date(event.start.date)
            : null;
        const eventEnd = event.end?.dateTime
          ? new Date(event.end.dateTime)
          : event.end?.date
            ? new Date(event.end.date)
            : null;

        if (!eventStart) continue;

        // For multi-day events, create an entry for each day
        const dates: string[] = [];
        if (eventEnd && event.start?.date) {
          // All-day event — end date is exclusive
          const d = new Date(eventStart);
          while (d < eventEnd) {
            dates.push(d.toISOString().split("T")[0]);
            d.setDate(d.getDate() + 1);
          }
        } else {
          dates.push(eventStart.toISOString().split("T")[0]);
        }

        for (const date of dates) {
          const id = `tce-g-${member.email}-${date}-${event.id}`;
          await sql`
            INSERT INTO team_calendar_entries (id, user_email, user_name, date, location, entry_type, note, source, google_event_id)
            VALUES (${id}, ${member.email}, ${member.name}, ${date}, ${location}, 'travel', ${event.summary || ''}, 'google_calendar', ${event.id})
            ON CONFLICT (id) DO UPDATE SET
              location = EXCLUDED.location,
              note = EXCLUDED.note
          `;
        }
      }

      synced++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ synced, failed, total: members.length });
}
