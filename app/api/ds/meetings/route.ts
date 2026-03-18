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
  const personId = request.nextUrl.searchParams.get("person_id");
  const limit = request.nextUrl.searchParams.get("limit");

  let meetings;
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
    meetings = await sql`SELECT * FROM ds_meetings WHERE group_id = ${groupId} ORDER BY date DESC`;
  } else if (deploymentId) {
    // Direct deployment filter
    const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${deploymentId}`;
    if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    meetings = await sql`SELECT * FROM ds_meetings WHERE deployment_id = ${deploymentId} ORDER BY date DESC`;
  } else if (personId) {
    // Get meetings where this person is an attendee (support both deployment_id and group chain)
    meetings = await sql`
      SELECT DISTINCT m.* FROM ds_meetings m
      JOIN ds_meeting_attendees ma ON ma.meeting_id = m.id
      LEFT JOIN ds_deployments d1 ON m.deployment_id = d1.id
      LEFT JOIN ds_groups g ON m.group_id = g.id
      LEFT JOIN ds_deployments d2 ON g.deployment_id = d2.id
      WHERE ma.person_id = ${personId}
        AND (d1.owner_email = ${session.user.email} OR d2.owner_email = ${session.user.email})
      ORDER BY m.date DESC
    `;
  } else {
    // All meetings (support both deployment_id and legacy group chain)
    meetings = await sql`
      SELECT DISTINCT m.* FROM ds_meetings m
      LEFT JOIN ds_deployments d1 ON m.deployment_id = d1.id
      LEFT JOIN ds_groups g ON m.group_id = g.id
      LEFT JOIN ds_deployments d2 ON g.deployment_id = d2.id
      WHERE d1.owner_email = ${session.user.email}
         OR d2.owner_email = ${session.user.email}
      ORDER BY m.date DESC
    `;
  }

  // Apply limit if specified
  if (limit) {
    meetings = meetings.slice(0, parseInt(limit, 10));
  }

  if (meetings.length === 0) {
    return NextResponse.json({ meetings: [] });
  }

  const meetingIds = meetings.map((m: any) => m.id);

  // Get attendees with person details — return as name strings for the view
  const attendeeRows = await sql`
    SELECT ma.meeting_id, p.name FROM ds_meeting_attendees ma
    JOIN ds_people p ON ma.person_id = p.id
    WHERE ma.meeting_id = ANY(${meetingIds})
  `;

  const attendeesByMeeting: Record<string, string[]> = {};
  for (const a of attendeeRows) {
    if (!attendeesByMeeting[a.meeting_id]) attendeesByMeeting[a.meeting_id] = [];
    attendeesByMeeting[a.meeting_id].push(a.name);
  }

  // Get action items
  const actionItems = await sql`
    SELECT * FROM ds_meeting_action_items
    WHERE meeting_id = ANY(${meetingIds})
    ORDER BY created_at ASC
  `;

  const actionsByMeeting: Record<string, any[]> = {};
  for (const ai of actionItems) {
    if (!actionsByMeeting[ai.meeting_id]) actionsByMeeting[ai.meeting_id] = [];
    actionsByMeeting[ai.meeting_id].push({
      id: ai.id,
      title: ai.text,
      done: ai.done,
      owner: ai.owner,
    });
  }

  // Get topics — return as string arrays
  const topics = await sql`
    SELECT * FROM ds_meeting_topics
    WHERE meeting_id = ANY(${meetingIds})
    ORDER BY sort_order ASC
  `;

  const topicsByMeeting: Record<string, string[]> = {};
  for (const t of topics) {
    if (!topicsByMeeting[t.meeting_id]) topicsByMeeting[t.meeting_id] = [];
    topicsByMeeting[t.meeting_id].push(t.topic);
  }

  // Get group names and company names for display
  const groupIds = [...new Set(meetings.map((m: any) => m.group_id).filter(Boolean))];
  let groupMap: Record<string, { name: string; company: string }> = {};
  if (groupIds.length > 0) {
    const groupRows = await sql`
      SELECT g.id, g.name, d.company FROM ds_groups g
      JOIN ds_deployments d ON g.deployment_id = d.id
      WHERE g.id = ANY(${groupIds})
    `;
    for (const g of groupRows) groupMap[g.id] = { name: g.name, company: g.company };
  }

  // Get deployment names for display (for meetings with deployment_id but no group)
  const depIds = [...new Set(meetings.map((m: any) => m.deployment_id).filter(Boolean))];
  let depMap: Record<string, { name: string; company: string }> = {};
  if (depIds.length > 0) {
    const depRows = await sql`SELECT id, name, company FROM ds_deployments WHERE id = ANY(${depIds})`;
    for (const d of depRows) depMap[d.id] = { name: d.name, company: d.company };
  }

  return NextResponse.json({
    meetings: meetings.map((m: any) => ({
      id: m.id,
      group_id: m.group_id || null,
      group_name: m.group_id ? (groupMap[m.group_id]?.name || "") : "",
      deployment_id: m.deployment_id || null,
      deployment_name: m.deployment_id ? (depMap[m.deployment_id]?.name || "") : "",
      company: (m.group_id ? groupMap[m.group_id]?.company : "") || (m.deployment_id ? depMap[m.deployment_id]?.company : "") || "",
      date: m.date,
      type: m.type,
      agenda_sent: m.agenda_sent,
      recap_sent: m.recap_sent,
      sentiment: m.sentiment,
      notes: m.notes,
      competitive_intel: m.competitive_intel ? m.competitive_intel.split("\n").filter(Boolean) : [],
      expansion_signals: m.expansion_signals ? m.expansion_signals.split("\n").filter(Boolean) : [],
      attendees: attendeesByMeeting[m.id] || [],
      action_items: actionsByMeeting[m.id] || [],
      topics: topicsByMeeting[m.id] || [],
    })),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { date, type, sentiment, notes, attendees, topics } = body;
  const groupId = body.group_id ?? body.groupId;
  const agendaSent = body.agenda_sent ?? body.agendaSent ?? false;
  const recapSent = body.recap_sent ?? body.recapSent ?? false;
  const competitiveIntel = body.competitive_intel ?? body.competitiveIntel;
  const expansionSignals = body.expansion_signals ?? body.expansionSignals;
  const actionItems = body.action_items ?? body.actionItems;

  if (!groupId || !date) {
    return NextResponse.json({ error: "Group ID and date are required" }, { status: 400 });
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

  const id = `ds-mtg-${Date.now()}`;

  // competitive_intel and expansion_signals are stored as newline-separated text
  const ciText = Array.isArray(competitiveIntel) ? competitiveIntel.join("\n") : (competitiveIntel || "");
  const esText = Array.isArray(expansionSignals) ? expansionSignals.join("\n") : (expansionSignals || "");

  await sql`
    INSERT INTO ds_meetings (id, group_id, date, type, agenda_sent, recap_sent, sentiment, notes, competitive_intel, expansion_signals)
    VALUES (${id}, ${groupId}, ${date}, ${type || "Weekly Check-in"}, ${agendaSent}, ${recapSent}, ${sentiment || "neutral"}, ${notes || ""}, ${ciText}, ${esText})
  `;

  // Insert attendees — attendees are person names from the form, need to look up IDs
  if (attendees && Array.isArray(attendees)) {
    // Attendees might be person IDs or person names
    for (const attendee of attendees) {
      // Try as person ID first, then by name
      const byId = await sql`SELECT id FROM ds_people WHERE id = ${attendee} LIMIT 1`;
      if (byId.length > 0) {
        await sql`
          INSERT INTO ds_meeting_attendees (meeting_id, person_id)
          VALUES (${id}, ${byId[0].id})
          ON CONFLICT DO NOTHING
        `;
      } else {
        // Look up by name within the same group
        const byName = await sql`SELECT id FROM ds_people WHERE name = ${attendee} AND group_id = ${groupId} LIMIT 1`;
        if (byName.length > 0) {
          await sql`
            INSERT INTO ds_meeting_attendees (meeting_id, person_id)
            VALUES (${id}, ${byName[0].id})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    }
  }

  // Insert topics
  if (topics && Array.isArray(topics)) {
    for (let i = 0; i < topics.length; i++) {
      const topicId = `ds-topic-${Date.now()}-${i}`;
      await sql`
        INSERT INTO ds_meeting_topics (id, meeting_id, topic, sort_order)
        VALUES (${topicId}, ${id}, ${topics[i]}, ${i})
      `;
    }
  }

  // Insert action items — accept both `title` and `text` field names
  if (actionItems && Array.isArray(actionItems)) {
    for (let i = 0; i < actionItems.length; i++) {
      const aiId = `ds-ai-${Date.now()}-${i}`;
      const item = actionItems[i];
      const text = item.title || item.text || "";
      await sql`
        INSERT INTO ds_meeting_action_items (id, meeting_id, text, owner, done)
        VALUES (${aiId}, ${id}, ${text}, ${item.owner || ""}, ${item.done || false})
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

  const body = await request.json();
  const { id, date, type, sentiment, notes, attendees, topics } = body;
  const agendaSent = body.agenda_sent ?? body.agendaSent;
  const recapSent = body.recap_sent ?? body.recapSent;
  const competitiveIntel = body.competitive_intel ?? body.competitiveIntel;
  const expansionSignals = body.expansion_signals ?? body.expansionSignals;
  const actionItems = body.action_items ?? body.actionItems;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership chain
  const meeting = await sql`SELECT group_id FROM ds_meetings WHERE id = ${id}`;
  if (meeting.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${meeting[0].group_id}`;
  if (group.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
  if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const ciText = competitiveIntel != null ? (Array.isArray(competitiveIntel) ? competitiveIntel.join("\n") : competitiveIntel) : null;
  const esText = expansionSignals != null ? (Array.isArray(expansionSignals) ? expansionSignals.join("\n") : expansionSignals) : null;

  await sql`
    UPDATE ds_meetings SET
      date = COALESCE(${date ?? null}, date),
      type = COALESCE(${type ?? null}, type),
      agenda_sent = COALESCE(${agendaSent ?? null}, agenda_sent),
      recap_sent = COALESCE(${recapSent ?? null}, recap_sent),
      sentiment = COALESCE(${sentiment ?? null}, sentiment),
      notes = COALESCE(${notes ?? null}, notes),
      competitive_intel = COALESCE(${ciText}, competitive_intel),
      expansion_signals = COALESCE(${esText}, expansion_signals),
      updated_at = NOW()
    WHERE id = ${id}
  `;

  // Replace attendees if provided
  if (attendees && Array.isArray(attendees)) {
    await sql`DELETE FROM ds_meeting_attendees WHERE meeting_id = ${id}`;
    const groupId = meeting[0].group_id;
    for (const attendee of attendees) {
      const byId = await sql`SELECT id FROM ds_people WHERE id = ${attendee} LIMIT 1`;
      if (byId.length > 0) {
        await sql`
          INSERT INTO ds_meeting_attendees (meeting_id, person_id)
          VALUES (${id}, ${byId[0].id})
          ON CONFLICT DO NOTHING
        `;
      } else {
        const byName = await sql`SELECT id FROM ds_people WHERE name = ${attendee} AND group_id = ${groupId} LIMIT 1`;
        if (byName.length > 0) {
          await sql`
            INSERT INTO ds_meeting_attendees (meeting_id, person_id)
            VALUES (${id}, ${byName[0].id})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    }
  }

  // Replace topics if provided
  if (topics && Array.isArray(topics)) {
    await sql`DELETE FROM ds_meeting_topics WHERE meeting_id = ${id}`;
    for (let i = 0; i < topics.length; i++) {
      const topicId = `ds-topic-${Date.now()}-${i}`;
      await sql`
        INSERT INTO ds_meeting_topics (id, meeting_id, topic, sort_order)
        VALUES (${topicId}, ${id}, ${topics[i]}, ${i})
      `;
    }
  }

  // Update action items if provided (replace all) — accept both `title` and `text`
  if (actionItems && Array.isArray(actionItems)) {
    await sql`DELETE FROM ds_meeting_action_items WHERE meeting_id = ${id}`;
    for (let i = 0; i < actionItems.length; i++) {
      const aiId = actionItems[i].id || `ds-ai-${Date.now()}-${i}`;
      const item = actionItems[i];
      const text = item.title || item.text || "";
      await sql`
        INSERT INTO ds_meeting_action_items (id, meeting_id, text, owner, done)
        VALUES (${aiId}, ${id}, ${text}, ${item.owner || ""}, ${item.done || false})
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

  // Verify ownership chain
  const meeting = await sql`SELECT group_id FROM ds_meetings WHERE id = ${id}`;
  if (meeting.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const group = await sql`SELECT deployment_id FROM ds_groups WHERE id = ${meeting[0].group_id}`;
  if (group.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dep = await sql`SELECT owner_email FROM ds_deployments WHERE id = ${group[0].deployment_id}`;
  if (dep.length === 0 || dep[0].owner_email !== session.user.email) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Cascade delete children
  await sql`DELETE FROM ds_meeting_attendees WHERE meeting_id = ${id}`;
  await sql`DELETE FROM ds_meeting_action_items WHERE meeting_id = ${id}`;
  await sql`DELETE FROM ds_meeting_topics WHERE meeting_id = ${id}`;
  await sql`DELETE FROM ds_meetings WHERE id = ${id}`;

  return NextResponse.json({ ok: true });
}
