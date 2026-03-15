import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const templates = await sql`SELECT * FROM report_templates ORDER BY created_at ASC`;

  return NextResponse.json({
    templates: templates.map((t: any) => ({
      id: t.id,
      name: t.name,
      content: t.content,
      creatorEmail: t.creator_email,
      createdAt: t.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, content } = await request.json();
  if (!name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Name and content required" }, { status: 400 });
  }

  const sql = getDb();
  const id = `tmpl-${Date.now()}`;

  await sql`
    INSERT INTO report_templates (id, name, content, creator_email)
    VALUES (${id}, ${name.trim()}, ${content.trim()}, ${session.user.email})
  `;

  return NextResponse.json({ id });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, content } = await request.json();
  if (!id || !name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "ID, name, and content required" }, { status: 400 });
  }

  const sql = getDb();
  await sql`UPDATE report_templates SET name = ${name.trim()}, content = ${content.trim()} WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  const sql = getDb();
  await sql`DELETE FROM report_templates WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
