import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { toolId, enabled } = await request.json();
  const sql = getDb();

  if (enabled) {
    await sql`
      INSERT INTO enabled_tools (user_email, tool_id) VALUES (${session.user.email}, ${toolId})
      ON CONFLICT DO NOTHING
    `;
  } else {
    await sql`
      DELETE FROM enabled_tools WHERE user_email = ${session.user.email} AND tool_id = ${toolId}
    `;
  }

  return NextResponse.json({ ok: true });
}
