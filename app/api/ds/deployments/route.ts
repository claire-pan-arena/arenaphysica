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

  // Return unique company names for the company dropdown
  const companiesOnly = request.nextUrl.searchParams.get("companies_only");
  if (companiesOnly === "true") {
    const rows = await sql`SELECT DISTINCT company FROM ds_deployments WHERE company IS NOT NULL AND company != '' ORDER BY company`;
    return NextResponse.json({ companies: rows.map((r: any) => r.company) });
  }

  const deployments = await sql`
    SELECT * FROM ds_deployments
    WHERE owner_email = ${session.user.email}
    ORDER BY created_at DESC
  `;

  const deploymentIds = deployments.map((d: any) => d.id);

  // Get all groups for these deployments
  let allGroups: any[] = [];
  if (deploymentIds.length > 0) {
    allGroups = await sql`SELECT * FROM ds_groups WHERE deployment_id = ANY(${deploymentIds})`;
  }

  const groupIds = allGroups.map((g: any) => g.id);

  // Get people counts and champions per group
  let allPeople: any[] = [];
  if (groupIds.length > 0) {
    allPeople = await sql`SELECT id, group_id, name, is_champion FROM ds_people WHERE group_id = ANY(${groupIds})`;
  }

  // Get workstream + task stats per group
  let allWorkstreams: any[] = [];
  if (groupIds.length > 0) {
    allWorkstreams = await sql`SELECT id, group_id FROM ds_workstreams WHERE group_id = ANY(${groupIds})`;
  }
  const wsIds = allWorkstreams.map((w: any) => w.id);
  let allTasks: any[] = [];
  if (wsIds.length > 0) {
    allTasks = await sql`SELECT workstream_id, status FROM ds_tasks WHERE workstream_id = ANY(${wsIds})`;
  }

  // Build stats maps
  const wsToGroup: Record<string, string> = {};
  for (const w of allWorkstreams) wsToGroup[w.id] = w.group_id;

  const groupStats: Record<string, { ws: number; people: number; done: number; total: number; champions: string[] }> = {};
  for (const g of allGroups) {
    groupStats[g.id] = { ws: 0, people: 0, done: 0, total: 0, champions: [] };
  }
  for (const w of allWorkstreams) {
    if (groupStats[w.group_id]) groupStats[w.group_id].ws++;
  }
  for (const p of allPeople) {
    if (groupStats[p.group_id]) {
      groupStats[p.group_id].people++;
      if (p.is_champion) groupStats[p.group_id].champions.push(p.name);
    }
  }
  for (const t of allTasks) {
    const gId = wsToGroup[t.workstream_id];
    if (gId && groupStats[gId]) {
      groupStats[gId].total++;
      if (t.status === "done") groupStats[gId].done++;
    }
  }

  // Group groups by deployment
  const groupsByDep: Record<string, any[]> = {};
  for (const g of allGroups) {
    if (!groupsByDep[g.deployment_id]) groupsByDep[g.deployment_id] = [];
    const stats = groupStats[g.id];
    groupsByDep[g.deployment_id].push({
      id: g.id,
      deployment_id: g.deployment_id,
      name: g.name,
      description: g.description,
      health: g.health,
      workstream_count: stats.ws,
      people_count: stats.people,
      completion_pct: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
      champions: stats.champions,
    });
  }

  return NextResponse.json({
    deployments: deployments.map((d: any) => ({
      id: d.id,
      name: d.name || "",
      company: d.company,
      company_id: d.company_id || null,
      status: d.status,
      start_date: d.start_date,
      health: d.health,
      notes: d.notes,
      owner_email: d.owner_email,
      groups: groupsByDep[d.id] || [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = body.name;
  const company = body.company;
  const startDate = body.start_date ?? body.startDate;
  const health = body.health;
  const status = body.status;
  const notes = body.notes;
  if (!company?.trim()) {
    return NextResponse.json({ error: "Company is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();
  const id = `ds-dep-${Date.now()}`;

  await sql`
    INSERT INTO ds_deployments (id, name, company, start_date, health, status, notes, owner_email)
    VALUES (${id}, ${name || ""}, ${company.trim()}, ${startDate || null}, ${health || "green"}, ${status || "prospect"}, ${notes || ""}, ${session.user.email})
  `;

  return NextResponse.json({ id });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, company, health, status, notes } = body;
  const startDate = body.start_date ?? body.startDate;
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  const existing = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${id}`;
  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`
    UPDATE ds_deployments SET
      name = COALESCE(${name ?? null}, name),
      company = COALESCE(${company ?? null}, company),
      start_date = COALESCE(${startDate ?? null}, start_date),
      health = COALESCE(${health ?? null}, health),
      status = COALESCE(${status ?? null}, status),
      notes = COALESCE(${notes ?? null}, notes),
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

  const existing = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${id}`;
  if (existing.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Cascade delete: groups -> people, workstreams -> tasks, meetings -> attendees/action_items/topics
  const groups = await sql`SELECT id FROM ds_groups WHERE deployment_id = ${id}`;
  const groupIds = groups.map((g: any) => g.id);

  if (groupIds.length > 0) {
    // Delete people in these groups
    await sql`DELETE FROM ds_people WHERE group_id = ANY(${groupIds})`;

    // Delete workstream tasks, then workstreams
    const workstreams = await sql`SELECT id FROM ds_workstreams WHERE group_id = ANY(${groupIds})`;
    const wsIds = workstreams.map((w: any) => w.id);
    if (wsIds.length > 0) {
      await sql`DELETE FROM ds_tasks WHERE workstream_id = ANY(${wsIds})`;
    }
    await sql`DELETE FROM ds_workstreams WHERE group_id = ANY(${groupIds})`;

    // Delete meeting children, then meetings
    const meetings = await sql`SELECT id FROM ds_meetings WHERE group_id = ANY(${groupIds})`;
    const meetingIds = meetings.map((m: any) => m.id);
    if (meetingIds.length > 0) {
      await sql`DELETE FROM ds_meeting_attendees WHERE meeting_id = ANY(${meetingIds})`;
      await sql`DELETE FROM ds_meeting_action_items WHERE meeting_id = ANY(${meetingIds})`;
      await sql`DELETE FROM ds_meeting_topics WHERE meeting_id = ANY(${meetingIds})`;
    }
    await sql`DELETE FROM ds_meetings WHERE group_id = ANY(${groupIds})`;

    // Delete groups
    await sql`DELETE FROM ds_groups WHERE deployment_id = ${id}`;
  }

  // Also delete internal workstreams linked to this deployment
  const internalWs = await sql`SELECT id FROM ds_workstreams WHERE linked_deployment_id = ${id}`;
  const internalWsIds = internalWs.map((w: any) => w.id);
  if (internalWsIds.length > 0) {
    await sql`DELETE FROM ds_tasks WHERE workstream_id = ANY(${internalWsIds})`;
    await sql`DELETE FROM ds_workstreams WHERE linked_deployment_id = ${id}`;
  }

  await sql`DELETE FROM ds_deployments WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
