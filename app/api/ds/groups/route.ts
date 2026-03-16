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

  const deploymentId = request.nextUrl.searchParams.get("deployment_id");

  let groups;
  if (deploymentId) {
    // Verify deployment ownership
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${deploymentId}`;
    if (dep.length === 0) {
      return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
    }
    if (dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    groups = await sql`
      SELECT * FROM ds_groups
      WHERE deployment_id = ${deploymentId}
      ORDER BY created_at ASC
    `;
  } else {
    // Get all groups for user's deployments
    groups = await sql`
      SELECT g.* FROM ds_groups g
      JOIN ds_deployments d ON g.deployment_id = d.id
      WHERE d.owner_email = ${session.user.email}
      ORDER BY g.created_at ASC
    `;
  }

  // Compute stats for each group
  const groupIds = groups.map((g: any) => g.id);
  let workstreamCounts: any[] = [];
  let peopleCounts: any[] = [];
  let completionStats: any[] = [];

  if (groupIds.length > 0) {
    workstreamCounts = await sql`
      SELECT group_id, COUNT(*) as count
      FROM ds_workstreams
      WHERE group_id = ANY(${groupIds})
      GROUP BY group_id
    `;

    peopleCounts = await sql`
      SELECT group_id, COUNT(*) as count
      FROM ds_people
      WHERE group_id = ANY(${groupIds})
      GROUP BY group_id
    `;

    // Get workstream IDs for completion calculation
    const workstreams = await sql`
      SELECT id, group_id FROM ds_workstreams
      WHERE group_id = ANY(${groupIds})
    `;
    const wsIds = workstreams.map((w: any) => w.id);

    if (wsIds.length > 0) {
      const tasks = await sql`
        SELECT workstream_id, status FROM ds_tasks
        WHERE workstream_id = ANY(${wsIds})
      `;

      // Build group -> task stats
      const wsToGroup: Record<string, string> = {};
      for (const w of workstreams) {
        wsToGroup[w.id] = w.group_id;
      }

      const groupTaskStats: Record<string, { total: number; done: number }> = {};
      for (const t of tasks) {
        const gId = wsToGroup[t.workstream_id];
        if (!groupTaskStats[gId]) groupTaskStats[gId] = { total: 0, done: 0 };
        groupTaskStats[gId].total++;
        if (t.status === "done") groupTaskStats[gId].done++;
      }

      completionStats = Object.entries(groupTaskStats).map(([groupId, stats]) => ({
        group_id: groupId,
        completion: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
      }));
    }
  }

  const wsCountMap: Record<string, number> = {};
  for (const wc of workstreamCounts) wsCountMap[wc.group_id] = Number(wc.count);

  const pCountMap: Record<string, number> = {};
  for (const pc of peopleCounts) pCountMap[pc.group_id] = Number(pc.count);

  const compMap: Record<string, number> = {};
  for (const cs of completionStats) compMap[cs.group_id] = cs.completion;

  return NextResponse.json({
    groups: groups.map((g: any) => ({
      id: g.id,
      deployment_id: g.deployment_id,
      name: g.name,
      description: g.description,
      health: g.health,
      workstream_count: wsCountMap[g.id] || 0,
      people_count: pCountMap[g.id] || 0,
      completion_pct: compMap[g.id] || 0,
      created_at: g.created_at,
      updated_at: g.updated_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, health } = body;
  const deploymentId = body.deployment_id ?? body.deploymentId;
  if (!deploymentId || !name?.trim()) {
    return NextResponse.json({ error: "Deployment ID and name are required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify deployment ownership
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${deploymentId}`;
  if (dep.length === 0) {
    return NextResponse.json({ error: "Deployment not found" }, { status: 404 });
  }
  if (dep[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const id = `ds-grp-${Date.now()}`;

  await sql`
    INSERT INTO ds_groups (id, deployment_id, name, description, health)
    VALUES (${id}, ${deploymentId}, ${name.trim()}, ${description || ""}, ${health || "green"})
  `;

  return NextResponse.json({ id });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, name, description, health } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership chain: group -> deployment -> owner
  const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${id}`;
  if (group.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
  if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`
    UPDATE ds_groups SET
      name = COALESCE(${name ?? null}, name),
      description = COALESCE(${description ?? null}, description),
      health = COALESCE(${health ?? null}, health),
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
  const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${id}`;
  if (group.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
  if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Cascade delete children
  await sql`DELETE FROM ds_people WHERE group_id = ${id}`;

  const workstreams = await sql`SELECT id FROM ds_workstreams WHERE group_id = ${id}`;
  const wsIds = workstreams.map((w: any) => w.id);
  if (wsIds.length > 0) {
    await sql`DELETE FROM ds_tasks WHERE workstream_id = ANY(${wsIds})`;
  }
  await sql`DELETE FROM ds_workstreams WHERE group_id = ${id}`;

  const meetings = await sql`SELECT id FROM ds_meetings WHERE group_id = ${id}`;
  const meetingIds = meetings.map((m: any) => m.id);
  if (meetingIds.length > 0) {
    await sql`DELETE FROM ds_meeting_attendees WHERE meeting_id = ANY(${meetingIds})`;
    await sql`DELETE FROM ds_meeting_action_items WHERE meeting_id = ANY(${meetingIds})`;
    await sql`DELETE FROM ds_meeting_topics WHERE meeting_id = ANY(${meetingIds})`;
  }
  await sql`DELETE FROM ds_meetings WHERE group_id = ${id}`;

  await sql`DELETE FROM ds_groups WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
