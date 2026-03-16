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

  const snapshots = await sql`
    SELECT * FROM ds_weekly_snapshots
    WHERE user_email = ${session.user.email}
    ORDER BY week_of DESC
  `;

  if (snapshots.length === 0) {
    return NextResponse.json({ snapshots: [] });
  }

  const snapshotIds = snapshots.map((s: any) => s.id);

  // Get items for all snapshots
  const items = await sql`
    SELECT * FROM ds_weekly_snapshot_items
    WHERE snapshot_id = ANY(${snapshotIds})
  `;

  // Get task details for items
  const taskIds = items.map((i: any) => i.task_id).filter(Boolean);
  let tasks: any[] = [];
  if (taskIds.length > 0) {
    tasks = await sql`
      SELECT * FROM ds_tasks
      WHERE id = ANY(${taskIds})
    `;
  }

  const taskMap: Record<string, any> = {};
  for (const t of tasks) {
    taskMap[t.id] = {
      id: t.id,
      workstreamId: t.workstream_id,
      title: t.title,
      status: t.status,
      owner: t.owner,
      dueDate: t.due_date,
      sortOrder: t.sort_order,
    };
  }

  const itemsBySnapshot: Record<string, any[]> = {};
  for (const i of items) {
    if (!itemsBySnapshot[i.snapshot_id]) itemsBySnapshot[i.snapshot_id] = [];
    itemsBySnapshot[i.snapshot_id].push({
      id: i.id,
      taskId: i.task_id,
      priority: i.priority,
      notes: i.notes,
      task: taskMap[i.task_id] || null,
    });
  }

  return NextResponse.json({
    snapshots: snapshots.map((s: any) => ({
      id: s.id,
      user_email: s.user_email,
      week_of: s.week_of,
      reflections: s.reflections,
      items: itemsBySnapshot[s.id] || [],
      created_at: s.created_at,
      updated_at: s.updated_at,
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { reflections, items } = body;
  const weekOf = body.week_of ?? body.weekOf;
  if (!weekOf) {
    return NextResponse.json({ error: "Week of date is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  const id = `ds-snap-${Date.now()}`;

  await sql`
    INSERT INTO ds_weekly_snapshots (id, user_email, week_of, reflections)
    VALUES (${id}, ${session.user.email}, ${weekOf}, ${reflections || ""})
  `;

  // Insert items
  if (items && Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const itemId = `ds-snapi-${Date.now()}-${i}`;
      const item = items[i];
      await sql`
        INSERT INTO ds_weekly_snapshot_items (id, snapshot_id, task_id, priority, notes)
        VALUES (${itemId}, ${id}, ${item.taskId}, ${item.priority || "p1"}, ${item.notes || ""})
      `;
    }
  }

  return NextResponse.json({ id });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, reflections, items } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership
  const snapshot = await sql`SELECT user_email FROM ds_weekly_snapshots WHERE id = ${id}`;
  if (snapshot.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (snapshot[0].user_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await sql`
    UPDATE ds_weekly_snapshots SET
      reflections = COALESCE(${reflections ?? null}, reflections),
      updated_at = NOW()
    WHERE id = ${id}
  `;

  // Replace items if provided
  if (items && Array.isArray(items)) {
    await sql`DELETE FROM ds_weekly_snapshot_items WHERE snapshot_id = ${id}`;
    for (let i = 0; i < items.length; i++) {
      const itemId = items[i].id || `ds-snapi-${Date.now()}-${i}`;
      const item = items[i];
      await sql`
        INSERT INTO ds_weekly_snapshot_items (id, snapshot_id, task_id, priority, notes)
        VALUES (${itemId}, ${id}, ${item.taskId}, ${item.priority || "p1"}, ${item.notes || ""})
      `;
    }
  }

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
  const snapshot = await sql`SELECT user_email FROM ds_weekly_snapshots WHERE id = ${id}`;
  if (snapshot.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (snapshot[0].user_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Cascade delete items
  await sql`DELETE FROM ds_weekly_snapshot_items WHERE snapshot_id = ${id}`;
  await sql`DELETE FROM ds_weekly_snapshots WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
