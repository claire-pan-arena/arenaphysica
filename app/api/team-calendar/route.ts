import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const weekStart = request.nextUrl.searchParams.get("weekStart") || "";
  const weeks = parseInt(request.nextUrl.searchParams.get("weeks") || "2", 10);

  if (!weekStart) {
    return NextResponse.json({ error: "weekStart required" }, { status: 400 });
  }

  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7);
  const endStr = end.toISOString().split("T")[0];

  const members = await sql`SELECT email, name FROM team_members ORDER BY name`;
  const entries = await sql`
    SELECT * FROM team_calendar_entries
    WHERE date >= ${weekStart} AND date < ${endStr}
    ORDER BY date
  `;

  // Group entries by user
  const memberMap: Record<string, { email: string; name: string; entries: any[] }> = {};
  for (const m of members) {
    memberMap[m.email] = { email: m.email, name: m.name, entries: [] };
  }
  for (const e of entries) {
    if (!memberMap[e.user_email]) {
      memberMap[e.user_email] = { email: e.user_email, name: e.user_name, entries: [] };
    }
    memberMap[e.user_email].entries.push({
      id: e.id,
      date: e.date,
      location: e.location,
      entryType: e.entry_type,
      note: e.note,
      source: e.source,
    });
  }

  return NextResponse.json({ members: Object.values(memberMap) });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const { date, location, entryType, note } = await request.json();
  if (!date || !location) {
    return NextResponse.json({ error: "date and location required" }, { status: 400 });
  }

  const id = `tce-${Date.now()}`;
  await sql`
    INSERT INTO team_calendar_entries (id, user_email, user_name, date, location, entry_type, note, source)
    VALUES (${id}, ${session.user.email}, ${session.user.name || "Unknown"}, ${date}, ${location}, ${entryType || "travel"}, ${note || ""}, 'manual')
  `;

  return NextResponse.json({ id });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  const sql = getDb();
  await sql`DELETE FROM team_calendar_entries WHERE id = ${id} AND user_email = ${session.user.email}`;

  return NextResponse.json({ ok: true });
}
