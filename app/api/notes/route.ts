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

  const customer = request.nextUrl.searchParams.get("customer");
  const week = request.nextUrl.searchParams.get("week");

  let notes;
  if (customer && week) {
    // Get notes for a specific customer in a specific week
    const weekEnd = new Date(week);
    weekEnd.setDate(weekEnd.getDate() + 7);
    notes = await sql`
      SELECT * FROM meeting_notes
      WHERE customer = ${customer}
        AND event_date >= ${week}
        AND event_date < ${weekEnd.toISOString().split("T")[0]}
      ORDER BY created_at DESC
    `;
  } else if (customer) {
    notes = await sql`SELECT * FROM meeting_notes WHERE customer = ${customer} ORDER BY created_at DESC`;
  } else {
    notes = await sql`SELECT * FROM meeting_notes ORDER BY created_at DESC LIMIT 50`;
  }

  return NextResponse.json({
    notes: notes.map((n: any) => ({
      id: n.id,
      content: n.content,
      customer: n.customer,
      eventTitle: n.event_title,
      eventDate: n.event_date,
      creatorName: n.creator_name,
      creatorEmail: n.creator_email,
      createdAt: n.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content, customer, eventTitle, eventDate } = await request.json();
  if (!content?.trim() || !customer?.trim()) {
    return NextResponse.json({ error: "Content and customer required" }, { status: 400 });
  }

  const sql = getDb();
  const id = `note-${Date.now()}`;

  await sql`
    INSERT INTO meeting_notes (id, content, customer, event_title, event_date, creator_email, creator_name)
    VALUES (${id}, ${content.trim()}, ${customer.trim()}, ${eventTitle?.trim() || null}, ${eventDate || null}, ${session.user.email}, ${session.user.name || "Unknown"})
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

  const note = await sql`SELECT creator_email FROM meeting_notes WHERE id = ${id}`;
  if (note.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (note[0].creator_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`DELETE FROM meeting_notes WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
