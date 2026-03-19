import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { syncMemberCalendar } from "@/lib/calendar-sync";
import { syncNotionOOO } from "@/lib/notion-ooo-sync";
import { NextRequest, NextResponse } from "next/server";

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

  const members = await sql`SELECT email, name, refresh_token FROM team_members`;

  // Get each member's home base
  const prefs = await sql`SELECT user_email, home_base FROM travel_preferences`;
  const homeBaseMap: Record<string, string> = {};
  for (const p of prefs) {
    homeBaseMap[p.user_email] = (p.home_base || "NYC").toLowerCase();
  }

  let synced = 0;
  let failed = 0;

  for (const member of members) {
    const homeBase = homeBaseMap[member.email] || "nyc";
    const ok = await syncMemberCalendar(sql, member as any, homeBase, start, end, weekStart);
    if (ok) synced++;
    else failed++;
  }

  // Also sync Notion OOO entries
  const ooo = await syncNotionOOO(sql);

  // Reverse sync: remove entries whose Google Calendar events were deleted
  let gcalDeleted = 0;
  const teamCalId = process.env.TEAM_CALENDAR_ID;
  if (teamCalId) {
    const accessToken = (session as any).accessToken;
    if (accessToken) {
      const linkedEntries = await sql`
        SELECT DISTINCT google_event_id FROM team_calendar_entries
        WHERE google_event_id IS NOT NULL AND google_event_id != ''
      `;
      for (const row of linkedEntries) {
        try {
          const res = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(teamCalId)}/events/${encodeURIComponent(row.google_event_id)}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (res.status === 404 || res.status === 410) {
            await sql`DELETE FROM team_calendar_entries WHERE google_event_id = ${row.google_event_id}`;
            gcalDeleted++;
          }
        } catch {}
      }
    }
  }

  return NextResponse.json({ synced, failed, total: members.length, notionOOO: ooo, gcalDeleted });
}
