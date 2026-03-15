import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET - list all KB notes
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();

  try {
    await initDb();
    const notes = await sql`SELECT * FROM kb_notes ORDER BY updated_at DESC`;

    return NextResponse.json({
      notes: notes.map((n: any) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        creatorEmail: n.creator_email,
        creatorName: n.creator_name,
        updatedByName: n.updated_by_name,
        createdAt: n.created_at,
        updatedAt: n.updated_at,
      })),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST - create a new note
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, content } = await request.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const sql = getDb();
  const id = `kb-${Date.now()}`;

  await sql`
    INSERT INTO kb_notes (id, title, content, creator_email, creator_name, updated_by_email, updated_by_name)
    VALUES (${id}, ${title.trim()}, ${content?.trim() || ""}, ${session.user.email}, ${session.user.name || "Unknown"}, ${session.user.email}, ${session.user.name || "Unknown"})
  `;

  return NextResponse.json({ id });
}

// PUT - update an existing note (any authenticated user can edit)
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, title, content } = await request.json();
  if (!id || !title?.trim()) {
    return NextResponse.json({ error: "ID and title required" }, { status: 400 });
  }

  const sql = getDb();

  await sql`
    UPDATE kb_notes
    SET title = ${title.trim()}, content = ${content?.trim() || ""}, updated_by_email = ${session.user.email}, updated_by_name = ${session.user.name || "Unknown"}, updated_at = NOW()
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true });
}

// DELETE - only the creator can delete
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  const sql = getDb();

  const note = await sql`SELECT creator_email FROM kb_notes WHERE id = ${id}`;
  if (note.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (note[0].creator_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`DELETE FROM kb_notes WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
