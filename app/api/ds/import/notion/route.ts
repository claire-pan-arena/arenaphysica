import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { fetchNotionPageContent } from "@/lib/notion";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST — Fetch a Notion page and return raw content for the Co-pilot to process.
 * Body: { notion_url: string }
 * Returns: { pageId, title, content, import_id }
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const notionUrl = body.notion_url;
  if (!notionUrl?.trim()) {
    return NextResponse.json({ error: "notion_url is required" }, { status: 400 });
  }

  try {
    const { pageId, title, content } = await fetchNotionPageContent(notionUrl);

    const sql = getDb();
    await initDb();

    // Track the import
    const importId = `ds-imp-${Date.now()}`;
    await sql`
      INSERT INTO ds_notion_imports (id, notion_url, notion_page_id, raw_content, status, owner_email)
      VALUES (${importId}, ${notionUrl}, ${pageId}, ${content}, 'pending', ${session.user.email})
    `;

    return NextResponse.json({ pageId, title, content, import_id: importId });
  } catch (e: any) {
    console.error("[notion-import] Error fetching page:", e.message);
    return NextResponse.json({
      error: `Failed to fetch Notion page: ${e.message}`,
    }, { status: 500 });
  }
}

/**
 * PUT — Save confirmed structured data from a Notion import.
 * Body: {
 *   import_id: string,
 *   deployment_id: string,
 *   group_id: string,
 *   meeting?: { date, type, sentiment, notes, competitive_intel[], expansion_signals[] },
 *   people?: { name, role, company?, is_champion?, fun_fact?, notes? }[],
 *   action_items?: { text, owner }[],
 *   topics?: string[],
 * }
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { import_id, deployment_id, group_id, meeting, people, action_items, topics } = body;

  if (!deployment_id) {
    return NextResponse.json({ error: "deployment_id is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Verify ownership
  const dep = deployment_id
    ? await sql`SELECT id FROM ds_deployments WHERE id = ${deployment_id} AND owner_email = ${session.user.email}`
    : [];
  if (deployment_id && dep.length === 0) {
    return NextResponse.json({ error: "Deployment not found or not owned by you" }, { status: 403 });
  }

  const results: any = { people_created: 0, people_updated: 0, meeting_created: false, action_items_created: 0, topics_created: 0 };

  // ── Create/update people ──
  const personIdMap: Record<string, string> = {}; // name → id
  if (people && Array.isArray(people)) {
    for (const p of people) {
      if (!p.name?.trim()) continue;
      // Check for existing person by name (case-insensitive) within deployment
      const existing = await sql`
        SELECT id FROM ds_people WHERE LOWER(name) = LOWER(${p.name.trim()}) AND deployment_id = ${deployment_id}
      `;
      if (existing.length > 0) {
        // Update existing person
        const pid = existing[0].id;
        personIdMap[p.name.trim().toLowerCase()] = pid;
        await sql`
          UPDATE ds_people SET
            role = COALESCE(NULLIF(${p.role || ""}, ''), role),
            company = COALESCE(NULLIF(${p.company || ""}, ''), company),
            is_champion = COALESCE(${p.is_champion ?? null}, is_champion),
            fun_fact = CASE WHEN ${p.fun_fact || ""} != '' THEN COALESCE(fun_fact || ' | ', '') || ${p.fun_fact} ELSE fun_fact END,
            notes = CASE WHEN ${p.notes || ""} != '' THEN COALESCE(notes || '\n', '') || ${p.notes} ELSE notes END,
            updated_at = NOW()
          WHERE id = ${pid}
        `;
        results.people_updated++;
      } else {
        // Create new person
        const pid = `ds-per-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        personIdMap[p.name.trim().toLowerCase()] = pid;
        await sql`
          INSERT INTO ds_people (id, deployment_id, group_id, name, role, company, is_champion, sentiment, fun_fact, notes)
          VALUES (${pid}, ${deployment_id}, ${group_id || null}, ${p.name.trim()}, ${p.role || ""}, ${p.company || ""}, ${p.is_champion || false}, ${"neutral"}, ${p.fun_fact || ""}, ${p.notes || ""})
        `;
        results.people_created++;
      }
    }
  }

  // ── Create meeting ──
  let meetingId: string | null = null;
  if (meeting && meeting.date) {
    meetingId = `ds-mtg-${Date.now()}`;
    const competitiveIntel = Array.isArray(meeting.competitive_intel)
      ? meeting.competitive_intel.join("\n")
      : meeting.competitive_intel || "";
    const expansionSignals = Array.isArray(meeting.expansion_signals)
      ? meeting.expansion_signals.join("\n")
      : meeting.expansion_signals || "";

    await sql`
      INSERT INTO ds_meetings (id, deployment_id, group_id, date, type, sentiment, notes, competitive_intel, expansion_signals)
      VALUES (${meetingId}, ${deployment_id}, ${group_id || null}, ${meeting.date}, ${meeting.type || "Weekly Check-in"}, ${meeting.sentiment || "neutral"}, ${meeting.notes || ""}, ${competitiveIntel}, ${expansionSignals})
    `;
    results.meeting_created = true;

    // ── Add attendees ──
    if (people && Array.isArray(people)) {
      for (const p of people) {
        const pid = personIdMap[p.name.trim().toLowerCase()];
        if (pid) {
          await sql`
            INSERT INTO ds_meeting_attendees (meeting_id, person_id)
            VALUES (${meetingId}, ${pid})
            ON CONFLICT DO NOTHING
          `;
        }
      }
    }

    // ── Add action items ──
    if (action_items && Array.isArray(action_items)) {
      for (const ai of action_items) {
        if (!ai.text?.trim()) continue;
        const aiId = `ds-ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await sql`
          INSERT INTO ds_meeting_action_items (id, meeting_id, text, owner, done)
          VALUES (${aiId}, ${meetingId}, ${ai.text.trim()}, ${ai.owner || ""}, FALSE)
        `;
        results.action_items_created++;
      }
    }

    // ── Add topics ──
    if (topics && Array.isArray(topics)) {
      for (let i = 0; i < topics.length; i++) {
        if (!topics[i]?.trim()) continue;
        const topicId = `ds-topic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await sql`
          INSERT INTO ds_meeting_topics (id, meeting_id, topic, sort_order)
          VALUES (${topicId}, ${meetingId}, ${topics[i].trim()}, ${i})
        `;
        results.topics_created++;
      }
    }
  }

  // ── Update import record ──
  if (import_id) {
    await sql`
      UPDATE ds_notion_imports SET
        status = 'saved',
        target_deployment_id = ${deployment_id || null},
        target_group_id = ${group_id},
        extracted_data = ${JSON.stringify(body)}::jsonb
      WHERE id = ${import_id}
    `;
  }

  return NextResponse.json({ success: true, ...results, meeting_id: meetingId });
}
