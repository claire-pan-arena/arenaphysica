import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

// GET - list all tools + which ones current user has enabled
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();

  try {
    await initDb();

    const tools = await sql`SELECT * FROM tools ORDER BY created_at ASC`;
    const enabled = await sql`
      SELECT tool_id FROM enabled_tools WHERE user_email = ${session.user.email}
    `;

    const enabledIds = enabled.map((r: any) => r.tool_id);

    return NextResponse.json({
      tools: tools.map((t: any) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        creator: t.creator_name,
        creatorEmail: t.creator_email,
        category: t.category,
        url: t.url,
      })),
      enabledIds,
      currentUserEmail: session.user.email,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST - create a new tool
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, category, url } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  const sql = getDb();
  const id = `custom-${Date.now()}`;

  await sql`
    INSERT INTO tools (id, name, description, creator_email, creator_name, category, url)
    VALUES (${id}, ${name.trim()}, ${description?.trim() || ""}, ${session.user.email}, ${session.user.name || "Unknown"}, ${category || "Other"}, ${url?.trim() || null})
  `;

  // Auto-enable for creator
  await sql`
    INSERT INTO enabled_tools (user_email, tool_id) VALUES (${session.user.email}, ${id})
    ON CONFLICT DO NOTHING
  `;

  return NextResponse.json({ id });
}

// DELETE - delete a tool (only creator can delete)
export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  const sql = getDb();

  // Check ownership
  const tool = await sql`SELECT creator_email FROM tools WHERE id = ${id}`;
  if (tool.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (tool[0].creator_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`DELETE FROM enabled_tools WHERE tool_id = ${id}`;
  await sql`DELETE FROM tools WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
