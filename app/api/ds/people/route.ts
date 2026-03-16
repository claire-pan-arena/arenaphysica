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

  const groupId = request.nextUrl.searchParams.get("group_id");

  let people;
  if (groupId) {
    // Verify ownership chain: group -> deployment -> owner
    const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${groupId}`;
    if (group.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    people = await sql`
      SELECT * FROM ds_people
      WHERE group_id = ${groupId}
      ORDER BY name ASC
    `;
  } else {
    // Get all people across user's deployments
    people = await sql`
      SELECT p.* FROM ds_people p
      JOIN ds_groups g ON p.group_id = g.id
      JOIN ds_deployments d ON g.deployment_id = d.id
      WHERE d.owner_email = ${session.user.email}
      ORDER BY p.name ASC
    `;
  }

  // Also fetch group names for display
  const groupIds = [...new Set(people.map((p: any) => p.group_id))];
  let groupNameMap: Record<string, string> = {};
  if (groupIds.length > 0) {
    const grps = await sql`SELECT id, name FROM ds_groups WHERE id = ANY(${groupIds})`;
    for (const g of grps) groupNameMap[g.id] = g.name;
  }

  return NextResponse.json({
    people: people.map((p: any) => ({
      id: p.id,
      group_id: p.group_id,
      group_name: groupNameMap[p.group_id] || "",
      name: p.name,
      role: p.role,
      company: p.company,
      is_champion: p.is_champion,
      sentiment: p.sentiment,
      email: p.email,
      fun_fact: p.fun_fact,
      notes: p.notes,
      last_contact: p.last_contact,
      reports_to: p.reports_to,
      created_at: p.created_at,
      updated_at: p.updated_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, role, company, sentiment, email, notes } = body;
  const groupId = body.group_id ?? body.groupId;
  const isChampion = body.is_champion ?? body.isChampion;
  const funFact = body.fun_fact ?? body.funFact;
  const lastContact = body.last_contact ?? body.lastContact;
  const reportsTo = body.reports_to ?? body.reportsTo;
  if (!groupId || !name?.trim()) {
    return NextResponse.json({ error: "Group ID and name are required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership chain
  const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${groupId}`;
  if (group.length === 0) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
  if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const id = `ds-per-${Date.now()}`;

  await sql`
    INSERT INTO ds_people (id, group_id, name, role, company, is_champion, sentiment, email, fun_fact, notes, last_contact, reports_to)
    VALUES (${id}, ${groupId}, ${name.trim()}, ${role || ""}, ${company || ""}, ${isChampion || false}, ${sentiment || "neutral"}, ${email || ""}, ${funFact || ""}, ${notes || ""}, ${lastContact || null}, ${reportsTo || null})
  `;

  return NextResponse.json({ id });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, role, company, sentiment, email, notes } = body;
  const isChampion = body.is_champion ?? body.isChampion;
  const funFact = body.fun_fact ?? body.funFact;
  const lastContact = body.last_contact ?? body.lastContact;
  const reportsTo = body.reports_to ?? body.reportsTo;
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership chain
  const person = await sql`SELECT group_id FROM ds_people WHERE id = ${id}`;
  if (person.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${person[0].group_id}`;
  if (group.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
  if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`
    UPDATE ds_people SET
      name = COALESCE(${name ?? null}, name),
      role = COALESCE(${role ?? null}, role),
      company = COALESCE(${company ?? null}, company),
      is_champion = COALESCE(${isChampion ?? null}, is_champion),
      sentiment = COALESCE(${sentiment ?? null}, sentiment),
      email = COALESCE(${email ?? null}, email),
      fun_fact = COALESCE(${funFact ?? null}, fun_fact),
      notes = COALESCE(${notes ?? null}, notes),
      last_contact = COALESCE(${lastContact ?? null}, last_contact),
      reports_to = COALESCE(${reportsTo ?? null}, reports_to),
      updated_at = NOW()
    WHERE id = ${id}
  `;

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership chain
  const person = await sql`SELECT group_id FROM ds_people WHERE id = ${id}`;
  if (person.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${person[0].group_id}`;
  if (group.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
  if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`DELETE FROM ds_people WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
