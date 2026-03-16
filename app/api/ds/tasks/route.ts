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

  const workstreamId = request.nextUrl.searchParams.get("workstream_id");

  let tasks;
  if (workstreamId) {
    // Verify ownership chain: workstream -> group -> deployment -> owner
    const ws = await sql`SELECT group_id, linked_deployment_id, is_internal FROM ds_workstreams WHERE id = ${workstreamId}`;
    if (ws.length === 0) {
      return NextResponse.json({ error: "Workstream not found" }, { status: 404 });
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

    tasks = await sql`
      SELECT * FROM ds_tasks
      WHERE workstream_id = ${workstreamId}
      ORDER BY sort_order ASC, created_at ASC
    `;
  } else {
    // Get all tasks across user's workstreams
    tasks = await sql`
      SELECT t.* FROM ds_tasks t
      JOIN ds_workstreams w ON t.workstream_id = w.id
      LEFT JOIN ds_groups g ON w.group_id = g.id
      LEFT JOIN ds_deployments d ON g.deployment_id = d.id
      LEFT JOIN ds_deployments d2 ON w.linked_deployment_id = d2.id
      WHERE d.owner_email = ${session.user.email}
         OR d2.owner_email = ${session.user.email}
      ORDER BY t.sort_order ASC, t.created_at ASC
    `;
  }

  return NextResponse.json({
    tasks: tasks.map((t: any) => ({
      id: t.id,
      workstream_id: t.workstream_id,
      title: t.title,
      status: t.status,
      owner: t.owner,
      due_date: t.due_date,
      sort_order: t.sort_order,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, status, owner } = body;
  const workstreamId = body.workstream_id ?? body.workstreamId;
  const dueDate = body.due_date ?? body.dueDate;
  const sortOrder = body.sort_order ?? body.sortOrder;
  if (!workstreamId || !title?.trim()) {
    return NextResponse.json({ error: "Workstream ID and title are required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership chain
  const ws = await sql`SELECT group_id, linked_deployment_id, is_internal FROM ds_workstreams WHERE id = ${workstreamId}`;
  if (ws.length === 0) {
    return NextResponse.json({ error: "Workstream not found" }, { status: 404 });
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

  const id = `ds-task-${Date.now()}`;

  await sql`
    INSERT INTO ds_tasks (id, workstream_id, title, status, owner, due_date, sort_order)
    VALUES (${id}, ${workstreamId}, ${title.trim()}, ${status || "todo"}, ${owner || ""}, ${dueDate || null}, ${sortOrder ?? 0})
  `;

  return NextResponse.json({ id });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, title, status, owner } = body;
  const dueDate = body.due_date ?? body.dueDate;
  const sortOrder = body.sort_order ?? body.sortOrder;
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership chain
  const task = await sql`SELECT workstream_id FROM ds_tasks WHERE id = ${id}`;
  if (task.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ws = await sql`SELECT group_id, linked_deployment_id, is_internal FROM ds_workstreams WHERE id = ${task[0].workstream_id}`;
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
    UPDATE ds_tasks SET
      title = COALESCE(${title ?? null}, title),
      status = COALESCE(${status ?? null}, status),
      owner = COALESCE(${owner ?? null}, owner),
      due_date = COALESCE(${dueDate ?? null}, due_date),
      sort_order = COALESCE(${sortOrder ?? null}, sort_order),
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
  const task = await sql`SELECT workstream_id FROM ds_tasks WHERE id = ${id}`;
  if (task.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ws = await sql`SELECT group_id, linked_deployment_id, is_internal FROM ds_workstreams WHERE id = ${task[0].workstream_id}`;
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

  await sql`DELETE FROM ds_tasks WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
