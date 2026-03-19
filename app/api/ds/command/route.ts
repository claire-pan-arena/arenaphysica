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

  const userEmail = session.user.email;

  // Get all user's deployments
  const deployments = await sql`
    SELECT * FROM ds_deployments
    WHERE owner_email = ${userEmail}
    ORDER BY created_at DESC
  `;

  const deploymentIds = deployments.map((d: any) => d.id);

  if (deploymentIds.length === 0) {
    return NextResponse.json({
      needs_attention: { overdue: [], due_soon: [] },
      this_week: [],
      deployment_health: [],
      upcoming_deadlines: [],
      relationship_alerts: [],
      expansion_signals: [],
      competitive_intel: [],
    });
  }

  // Get all groups for these deployments
  const groups = await sql`
    SELECT * FROM ds_groups
    WHERE deployment_id = ANY(${deploymentIds})
  `;
  const groupIds = groups.map((g: any) => g.id);

  // Get all workstreams (group-based + internal)
  let workstreams: any[] = [];
  if (groupIds.length > 0) {
    workstreams = await sql`
      SELECT * FROM ds_workstreams
      WHERE group_id = ANY(${groupIds})
    `;
  }
  const internalWorkstreams = await sql`
    SELECT * FROM ds_workstreams
    WHERE is_internal = TRUE AND linked_deployment_id = ANY(${deploymentIds})
  `;
  workstreams = [...workstreams, ...internalWorkstreams];

  const wsIds = workstreams.map((w: any) => w.id);

  // Get all tasks
  let allTasks: any[] = [];
  if (wsIds.length > 0) {
    allTasks = await sql`
      SELECT * FROM ds_tasks
      WHERE workstream_id = ANY(${wsIds})
    `;
  }

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
  const threeDaysStr = threeDaysFromNow.toISOString().split("T")[0];

  // --- needs_attention: split into overdue and due_soon ---
  const attentionTasks = allTasks
    .filter((t: any) => t.status !== "done" && t.due_date && t.due_date <= threeDaysStr);

  const overdue = attentionTasks
    .filter((t: any) => t.due_date < todayStr)
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      owner: t.owner,
      due_date: t.due_date,
    }))
    .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));

  const dueSoon = attentionTasks
    .filter((t: any) => t.due_date >= todayStr)
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      owner: t.owner,
      due_date: t.due_date,
    }))
    .sort((a: any, b: any) => a.due_date.localeCompare(b.due_date));

  // --- this_week: most recent weekly snapshot items ---
  const snapshots = await sql`
    SELECT * FROM ds_weekly_snapshots
    WHERE user_email = ${userEmail}
    ORDER BY week_of DESC
    LIMIT 1
  `;

  let thisWeek: any[] = [];
  if (snapshots.length > 0) {
    const snap = snapshots[0];
    const snapshotItems = await sql`
      SELECT si.*, w.name as workstream_name
      FROM ds_weekly_snapshot_items si
      LEFT JOIN ds_workstreams w ON si.task_id = w.id
      WHERE si.snapshot_id = ${snap.id}
    `;

    thisWeek = snapshotItems.map((i: any) => ({
      workstream_id: i.task_id,
      workstream_name: i.workstream_name || "Unknown",
      priority: i.priority,
      status: i.notes || "in_progress",
      notes: i.notes,
    }));
  }

  // --- deployment_health ---
  const groupsByDep: Record<string, any[]> = {};
  for (const g of groups) {
    if (!groupsByDep[g.deployment_id]) groupsByDep[g.deployment_id] = [];
    groupsByDep[g.deployment_id].push(g);
  }

  const wsToGroup: Record<string, string> = {};
  for (const w of workstreams) {
    if (w.group_id) wsToGroup[w.id] = w.group_id;
  }

  const groupTaskStats: Record<string, { total: number; done: number }> = {};
  for (const t of allTasks) {
    const gId = wsToGroup[t.workstream_id];
    if (!gId) continue;
    if (!groupTaskStats[gId]) groupTaskStats[gId] = { total: 0, done: 0 };
    groupTaskStats[gId].total++;
    if (t.status === "done") groupTaskStats[gId].done++;
  }

  const deployment_health = deployments.map((d: any) => {
    const depGroups = (groupsByDep[d.id] || []).map((g: any) => {
      const stats = groupTaskStats[g.id] || { total: 0, done: 0 };
      return {
        name: g.name,
        health: g.health,
        completion_pct: stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0,
      };
    });

    return {
      id: d.id,
      name: d.name || "",
      company: d.company,
      health: d.health,
      status: d.status,
      groups: depGroups,
    };
  });

  // --- upcoming_deadlines ---
  const upcoming_deadlines = allTasks
    .filter((t: any) => t.status !== "done" && t.due_date)
    .sort((a: any, b: any) => (a.due_date || "").localeCompare(b.due_date || ""))
    .slice(0, 8)
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      owner: t.owner,
      due_date: t.due_date,
    }));

  // --- relationship_alerts: people with last_contact > 7 days ago ---
  let allPeople: any[] = [];
  if (deploymentIds.length > 0) {
    allPeople = await sql`
      SELECT * FROM ds_people
      WHERE deployment_id = ANY(${deploymentIds})
    `;
  }

  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysStr = sevenDaysAgo.toISOString().split("T")[0];

  const relationship_alerts = allPeople
    .filter((p: any) => p.last_contact && p.last_contact < sevenDaysStr)
    .map((p: any) => {
      const daysSince = Math.floor((today.getTime() - new Date(p.last_contact).getTime()) / 86400000);
      return {
        id: p.id,
        name: p.name,
        role: p.role,
        company: p.company,
        is_champion: p.is_champion,
        sentiment: p.sentiment,
        last_contact: p.last_contact,
        days_since_contact: daysSince,
      };
    })
    .sort((a: any, b: any) => b.days_since_contact - a.days_since_contact);

  // --- expansion_signals and competitive_intel from meetings ---
  let allMeetings: any[] = [];
  if (deploymentIds.length > 0) {
    allMeetings = await sql`
      SELECT m.*, g.name as group_name, d.company
      FROM ds_meetings m
      LEFT JOIN ds_groups g ON m.group_id = g.id
      LEFT JOIN ds_deployments d ON m.deployment_id = d.id
      WHERE m.deployment_id = ANY(${deploymentIds})
        AND (m.expansion_signals != '' OR m.competitive_intel != '')
      ORDER BY m.date DESC
      LIMIT 20
    `;
  }

  const expansion_signals: string[] = [];
  const competitive_intel: string[] = [];
  for (const m of allMeetings) {
    const label = m.group_name ? `${m.company} / ${m.group_name}` : (m.company || "Unknown");
    if (m.expansion_signals) {
      const signals = m.expansion_signals.split("\n").filter(Boolean);
      for (const s of signals) {
        const entry = `${label}: ${s}`;
        if (!expansion_signals.includes(entry)) expansion_signals.push(entry);
      }
    }
    if (m.competitive_intel) {
      const intel = m.competitive_intel.split("\n").filter(Boolean);
      for (const i of intel) {
        const entry = `${label}: ${i}`;
        if (!competitive_intel.includes(entry)) competitive_intel.push(entry);
      }
    }
  }

  return NextResponse.json({
    needs_attention: { overdue, due_soon: dueSoon },
    this_week: thisWeek,
    deployment_health,
    upcoming_deadlines,
    relationship_alerts,
    expansion_signals,
    competitive_intel,
  });
}
