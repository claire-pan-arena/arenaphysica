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

  const { date, location, entryType, note, forEmail, forName, action } = await request.json();

  // Action: add a team member
  if (action === "add_member") {
    if (!forEmail || !forName) {
      return NextResponse.json({ error: "email and name required" }, { status: 400 });
    }
    await sql`
      INSERT INTO team_members (email, name, updated_at)
      VALUES (${forEmail.toLowerCase().trim()}, ${forName.trim()}, NOW())
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    `;
    return NextResponse.json({ ok: true });
  }

  // Action: remove a team member
  if (action === "remove_member") {
    if (!forEmail) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }
    await sql`DELETE FROM team_members WHERE email = ${forEmail.toLowerCase().trim()}`;
    await sql`DELETE FROM team_calendar_entries WHERE user_email = ${forEmail.toLowerCase().trim()}`;
    return NextResponse.json({ ok: true });
  }

  if (!date || !location) {
    return NextResponse.json({ error: "date and location required" }, { status: 400 });
  }

  // Allow adding entries for other team members
  const targetEmail = forEmail ? forEmail.toLowerCase().trim() : session.user.email;
  const targetName = forName || session.user.name || "Unknown";

  const id = `tce-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO team_calendar_entries (id, user_email, user_name, date, location, entry_type, note, source)
    VALUES (${id}, ${targetEmail}, ${targetName}, ${date}, ${location}, ${entryType || "travel"}, ${note || ""}, 'manual')
  `;

  return NextResponse.json({ id });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const { id, date, location, entryType, note } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Build update fields
  const updates: string[] = [];
  if (date !== undefined) {
    await sql`UPDATE team_calendar_entries SET date = ${date} WHERE id = ${id}`;
  }
  if (location !== undefined) {
    await sql`UPDATE team_calendar_entries SET location = ${location} WHERE id = ${id}`;
  }
  if (entryType !== undefined) {
    await sql`UPDATE team_calendar_entries SET entry_type = ${entryType} WHERE id = ${id}`;
  }
  if (note !== undefined) {
    await sql`UPDATE team_calendar_entries SET note = ${note} WHERE id = ${id}`;
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  const sql = getDb();
  // Any team member can delete any entry (team calendar is collaborative)
  await sql`DELETE FROM team_calendar_entries WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
