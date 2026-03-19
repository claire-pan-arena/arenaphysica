import { getDb, initDb } from "@/lib/db";
import { syncMemberCalendar } from "@/lib/calendar-sync";
import { syncNotionOOO } from "@/lib/notion-ooo-sync";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  // Sync 4 weeks from today
  const now = new Date();
  const weekStart = now.toISOString().split("T")[0];
  const end = new Date(now);
  end.setDate(end.getDate() + 28);

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
    const ok = await syncMemberCalendar(sql, member as any, homeBase, now, end, weekStart);
    if (ok) synced++;
    else failed++;
  }

  // Also sync Notion OOO entries
  const ooo = await syncNotionOOO(sql);

  return NextResponse.json({ synced, failed, total: members.length, notionOOO: ooo });
}
