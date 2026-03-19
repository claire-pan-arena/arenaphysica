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

  const settings = await sql`
    SELECT key, value FROM ds_settings
    WHERE user_email = ${session.user.email}
  `;

  const result: Record<string, string> = {};
  for (const s of settings) {
    result[s.key] = s.value;
  }

  return NextResponse.json({ settings: result });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const body = await request.json();
  const { key, value } = body;

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const id = `ds-set-${Date.now()}`;

  await sql`
    INSERT INTO ds_settings (id, user_email, key, value, updated_at)
    VALUES (${id}, ${session.user.email}, ${key}, ${value || ""}, NOW())
    ON CONFLICT (user_email, key)
    DO UPDATE SET value = ${value || ""}, updated_at = NOW()
  `;

  return NextResponse.json({ success: true });
}
