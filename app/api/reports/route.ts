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

  let reports;
  if (customer) {
    reports = await sql`SELECT * FROM meeting_reports WHERE customer = ${customer} ORDER BY created_at DESC`;
  } else {
    reports = await sql`SELECT * FROM meeting_reports ORDER BY created_at DESC LIMIT 20`;
  }

  return NextResponse.json({
    reports: reports.map((r: any) => ({
      id: r.id,
      customer: r.customer,
      weekStart: r.week_start,
      templateId: r.template_id,
      content: r.content,
      creatorName: r.creator_name,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { customer, weekStart, templateId, content } = await request.json();
  if (!customer?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Customer and content required" }, { status: 400 });
  }

  const sql = getDb();
  const id = `report-${Date.now()}`;

  await sql`
    INSERT INTO meeting_reports (id, customer, week_start, template_id, content, creator_email, creator_name)
    VALUES (${id}, ${customer.trim()}, ${weekStart || ""}, ${templateId || null}, ${content.trim()}, ${session.user.email}, ${session.user.name || "Unknown"})
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
  await sql`DELETE FROM meeting_reports WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
