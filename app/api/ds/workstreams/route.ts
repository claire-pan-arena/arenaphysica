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
  const deploymentId = request.nextUrl.searchParams.get("deployment_id");

  let workstreams: any[];
  if (deploymentId) {
    // Verify deployment ownership
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${deploymentId}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    // Get all groups for this deployment, then workstreams for those groups
    const groups = await sql`SELECT id FROM ds_groups WHERE deployment_id = ${deploymentId}`;
    const gIds = groups.map((g: any) => g.id);
    if (gIds.length > 0) {
      workstreams = await sql`
        SELECT * FROM ds_workstreams
        WHERE group_id = ANY(${gIds})
        ORDER BY created_at ASC
      `;
    } else {
      workstreams = [];
    }
  } else if (groupId) {
    // Verify ownership chain: group -> deployment -> owner
    const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${groupId}`;
    if (group.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    workstreams = await sql`
      SELECT * FROM ds_workstreams
      WHERE group_id = ${groupId}
      ORDER BY created_at ASC
    `;
  } else {
    // Get all workstreams: group-based ones via deployment ownership, plus internal ones by owner_email
    const groupWorkstreams = await sql`
      SELECT w.* FROM ds_workstreams w
      JOIN ds_groups g ON w.group_id = g.id
      JOIN ds_deployments d ON g.deployment_id = d.id
      WHERE d.owner_email = ${session.user.email}
        AND (w.is_internal = FALSE OR w.is_internal IS NULL)
      ORDER BY w.created_at ASC
    `;

    const internalWorkstreams = await sql`
      SELECT w.* FROM ds_workstreams w
      JOIN ds_deployments d ON w.linked_deployment_id = d.id
      WHERE w.is_internal = TRUE
        AND d.owner_email = ${session.user.email}
      ORDER BY w.created_at ASC
    `;

    workstreams = [...groupWorkstreams, ...internalWorkstreams];
  }

  // Get tasks for each workstream
  const wsIds = workstreams.map((w: any) => w.id);
  let tasks: any[] = [];
  if (wsIds.length > 0) {
    tasks = await sql`
      SELECT * FROM ds_tasks
      WHERE workstream_id = ANY(${wsIds})
      ORDER BY sort_order ASC, created_at ASC
    `;
  }

  const tasksByWs: Record<string, any[]> = {};
  const taskStatsByWs: Record<string, { total: number; done: number }> = {};
  for (const t of tasks) {
    if (!tasksByWs[t.workstream_id]) tasksByWs[t.workstream_id] = [];
    tasksByWs[t.workstream_id].push({
      id: t.id,
      workstream_id: t.workstream_id,
      title: t.title,
      status: t.status,
      owner: t.owner,
      due_date: t.due_date,
      sort_order: t.sort_order,
    });
    if (!taskStatsByWs[t.workstream_id]) taskStatsByWs[t.workstream_id] = { total: 0, done: 0 };
    taskStatsByWs[t.workstream_id].total++;
    if (t.status === "done") taskStatsByWs[t.workstream_id].done++;
  }

  return NextResponse.json({
    workstreams: workstreams.map((w: any) => {
      const stats = taskStatsByWs[w.id] || { total: 0, done: 0 };
      return {
        id: w.id,
        group_id: w.group_id,
        name: w.name,
        owner: w.owner,
        status: w.status,
        priority: w.priority,
        start_date: w.start_date,
        due_date: w.due_date,
        description: w.description,
        is_internal: w.is_internal,
        linked_deployment_id: w.linked_deployment_id,
        tasks: tasksByWs[w.id] || [],
        tasks_done: stats.done,
        tasks_total: stats.total,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, owner, status, priority, description } = body;
  const groupId = body.group_id ?? body.groupId;
  const startDate = body.start_date ?? body.startDate;
  const dueDate = body.due_date ?? body.dueDate;
  const isInternal = body.is_internal ?? body.isInternal;
  const linkedDeploymentId = body.linked_deployment_id ?? body.linkedDeploymentId;
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership: either via group or via linked deployment for internal workstreams
  if (isInternal && linkedDeploymentId) {
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${linkedDeploymentId}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (groupId) {
    const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${groupId}`;
    if (group.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Group ID or linked deployment ID is required" }, { status: 400 });
  }

  const id = `ds-ws-${Date.now()}`;

  await sql`
    INSERT INTO ds_workstreams (id, group_id, name, owner, status, priority, start_date, due_date, description, is_internal, linked_deployment_id)
    VALUES (${id}, ${groupId || null}, ${name.trim()}, ${owner || ""}, ${status || "todo"}, ${priority || "p1"}, ${startDate || null}, ${dueDate || null}, ${description || ""}, ${isInternal || false}, ${linkedDeploymentId || null})
  `;

  return NextResponse.json({ id });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, owner, status, priority, description } = body;
  const startDate = body.start_date ?? body.startDate;
  const dueDate = body.due_date ?? body.dueDate;
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership via group or linked deployment
  const ws = await sql`SELECT group_id, linked_deployment_id, is_internal FROM ds_workstreams WHERE id = ${id}`;
  if (ws.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ws[0].is_internal && ws[0].linked_deployment_id) {
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${ws[0].linked_deployment_id}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (ws[0].group_id) {
    const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${ws[0].group_id}`;
    if (group.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  await sql`
    UPDATE ds_workstreams SET
      name = COALESCE(${name ?? null}, name),
      owner = COALESCE(${owner ?? null}, owner),
      status = COALESCE(${status ?? null}, status),
      priority = COALESCE(${priority ?? null}, priority),
      start_date = COALESCE(${startDate ?? null}, start_date),
      due_date = COALESCE(${dueDate ?? null}, due_date),
      description = COALESCE(${description ?? null}, description),
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
  const ws = await sql`SELECT group_id, linked_deployment_id, is_internal FROM ds_workstreams WHERE id = ${id}`;
  if (ws.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (ws[0].is_internal && ws[0].linked_deployment_id) {
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${ws[0].linked_deployment_id}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  } else if (ws[0].group_id) {
    const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${ws[0].group_id}`;
    if (group.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
  }

  // Cascade delete tasks
  await sql`DELETE FROM ds_tasks WHERE workstream_id = ${id}`;
  await sql`DELETE FROM ds_workstreams WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
