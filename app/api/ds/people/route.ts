import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/** Verify that the calling user owns the given deployment */
async function verifyDeploymentOwner(sql: any, deploymentId: string, email: string): Promise<boolean> {
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${deploymentId}`;
  return dep.length > 0 && dep[0].owner_email === email;
}

/** Verify ownership via deployment_id (primary) or group chain (legacy fallback) */
async function verifyPersonOwner(sql: any, personId: string, email: string): Promise<boolean> {
  const person = await sql`SELECT deployment_id, group_id FROM ds_people WHERE id = ${personId}`;
  if (person.length === 0) return false;
  const p = person[0];
  // Try deployment_id first (new path)
  if (p.deployment_id) {
    return verifyDeploymentOwner(sql, p.deployment_id, email);
  }
  // Fallback to group chain (legacy data)
  if (p.group_id) {
    const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${p.group_id}`;
    if (group.length === 0) return false;
    return verifyDeploymentOwner(sql, group[0].deployment_id, email);
  }
  return false;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const groupId = request.nextUrl.searchParams.get("group_id");
  const deploymentId = request.nextUrl.searchParams.get("deployment_id");

  let people;
  if (groupId) {
    // Filter by group (verify ownership via group chain)
    const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${groupId}`;
    if (group.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    if (!(await verifyDeploymentOwner(sql, group[0].deployment_id, session.user.email))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    people = await sql`SELECT * FROM ds_people WHERE group_id = ${groupId} ORDER BY name ASC`;
  } else if (deploymentId) {
    // Filter by deployment (direct ownership check)
    if (!(await verifyDeploymentOwner(sql, deploymentId, session.user.email))) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    people = await sql`SELECT * FROM ds_people WHERE deployment_id = ${deploymentId} ORDER BY name ASC`;
  } else {
    // Get all people across user's deployments (using deployment_id directly + legacy group chain)
    people = await sql`
      SELECT DISTINCT p.* FROM ds_people p
      LEFT JOIN ds_deployments d1 ON p.deployment_id = d1.id
      LEFT JOIN ds_groups g ON p.group_id = g.id
      LEFT JOIN ds_deployments d2 ON g.deployment_id = d2.id
      WHERE d1.owner_email = ${session.user.email}
         OR d2.owner_email = ${session.user.email}
      ORDER BY p.name ASC
    `;
  }

  // Fetch group names for display
  const groupIds = [...new Set(people.map((p: any) => p.group_id).filter(Boolean))];
  let groupNameMap: Record<string, string> = {};
  if (groupIds.length > 0) {
    const grps = await sql`SELECT id, name FROM ds_groups WHERE id = ANY(${groupIds})`;
    for (const g of grps) groupNameMap[g.id] = g.name;
  }

  // Fetch deployment names for display
  const depIds = [...new Set(people.map((p: any) => p.deployment_id).filter(Boolean))];
  let depNameMap: Record<string, { name: string; company: string }> = {};
  if (depIds.length > 0) {
    const deps = await sql`SELECT id, name, company FROM ds_deployments WHERE id = ANY(${depIds})`;
    for (const d of deps) depNameMap[d.id] = { name: d.name, company: d.company };
  }

  return NextResponse.json({
    people: people.map((p: any) => ({
      id: p.id,
      group_id: p.group_id || null,
      group_name: p.group_id ? (groupNameMap[p.group_id] || "") : "",
      deployment_id: p.deployment_id || null,
      deployment_name: p.deployment_id ? (depNameMap[p.deployment_id]?.name || "") : "",
      name: p.name,
      role: p.role,
      company: p.company || (p.deployment_id ? depNameMap[p.deployment_id]?.company : "") || "",
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
  const deploymentId = body.deployment_id ?? body.deploymentId;
  const groupId = body.group_id ?? body.groupId;
  const isChampion = body.is_champion ?? body.isChampion;
  const funFact = body.fun_fact ?? body.funFact;
  const lastContact = body.last_contact ?? body.lastContact;
  const reportsTo = body.reports_to ?? body.reportsTo;

  if (!deploymentId || !name?.trim()) {
    return NextResponse.json({ error: "Deployment and name are required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership of deployment
  if (!(await verifyDeploymentOwner(sql, deploymentId, session.user.email))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // If group_id provided, verify it belongs to this deployment
  if (groupId) {
    const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${groupId}`;
    if (group.length === 0 || group[0].deployment_id !== deploymentId) {
      return NextResponse.json({ error: "Group does not belong to this deployment" }, { status: 400 });
    }
  }

  const id = `ds-per-${Date.now()}`;

  await sql`
    INSERT INTO ds_people (id, deployment_id, group_id, name, role, company, is_champion, sentiment, email, fun_fact, notes, last_contact, reports_to)
    VALUES (${id}, ${deploymentId}, ${groupId || null}, ${name.trim()}, ${role || ""}, ${company || ""}, ${isChampion || false}, ${sentiment || "neutral"}, ${email || ""}, ${funFact || ""}, ${notes || ""}, ${lastContact || null}, ${reportsTo || null})
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
  const groupId = body.group_id ?? body.groupId;
  const deploymentId = body.deployment_id ?? body.deploymentId;
  const isChampion = body.is_champion ?? body.isChampion;
  const funFact = body.fun_fact ?? body.funFact;
  const lastContact = body.last_contact ?? body.lastContact;
  const reportsTo = body.reports_to ?? body.reportsTo;
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership
  if (!(await verifyPersonOwner(sql, id, session.user.email))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`
    UPDATE ds_people SET
      name = COALESCE(${name ?? null}, name),
      role = COALESCE(${role ?? null}, role),
      company = COALESCE(${company ?? null}, company),
      deployment_id = COALESCE(${deploymentId ?? null}, deployment_id),
      group_id = ${groupId !== undefined ? (groupId || null) : null},
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

  // Verify ownership
  if (!(await verifyPersonOwner(sql, id, session.user.email))) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`DELETE FROM ds_people WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
