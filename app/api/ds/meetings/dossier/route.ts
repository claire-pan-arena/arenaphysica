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

  // Get all groups across user's deployments
  const groups = await sql`
    SELECT g.id, g.name, g.health, d.company FROM ds_groups g
    JOIN ds_deployments d ON g.deployment_id = d.id
    WHERE d.owner_email = ${session.user.email}
    ORDER BY d.company ASC, g.name ASC
  `;

  if (groups.length === 0) {
    return NextResponse.json({ dossiers: [] });
  }

  const groupIds = groups.map((g: any) => g.id);

  // Get meeting counts per group
  const meetingCounts = await sql`
    SELECT group_id, COUNT(*) as count
    FROM ds_meetings
    WHERE group_id = ANY(${groupIds})
    GROUP BY group_id
  `;
  const meetingCountMap: Record<string, number> = {};
  for (const mc of meetingCounts) meetingCountMap[mc.group_id] = Number(mc.count);

  // Get champion counts per group
  const championCounts = await sql`
    SELECT group_id, COUNT(*) as count
    FROM ds_people
    WHERE group_id = ANY(${groupIds}) AND is_champion = TRUE
    GROUP BY group_id
  `;
  const championCountMap: Record<string, number> = {};
  for (const cc of championCounts) championCountMap[cc.group_id] = Number(cc.count);

  // Get open action item counts per group
  const meetingsByGroup = await sql`
    SELECT id, group_id FROM ds_meetings
    WHERE group_id = ANY(${groupIds})
  `;
  const meetingIdToGroup: Record<string, string> = {};
  const meetingIdsAll = meetingsByGroup.map((m: any) => {
    meetingIdToGroup[m.id] = m.group_id;
    return m.id;
  });

  let openActionMap: Record<string, number> = {};
  if (meetingIdsAll.length > 0) {
    const openActions = await sql`
      SELECT meeting_id FROM ds_meeting_action_items
      WHERE meeting_id = ANY(${meetingIdsAll}) AND done = FALSE
    `;
    for (const a of openActions) {
      const gId = meetingIdToGroup[a.meeting_id];
      if (gId) openActionMap[gId] = (openActionMap[gId] || 0) + 1;
    }
  }

  // Get latest sentiment per group (from most recent meeting)
  const latestMeetings = await sql`
    SELECT DISTINCT ON (group_id) group_id, sentiment
    FROM ds_meetings
    WHERE group_id = ANY(${groupIds})
    ORDER BY group_id, date DESC
  `;
  const sentimentMap: Record<string, string> = {};
  for (const m of latestMeetings) sentimentMap[m.group_id] = m.sentiment;

  // Get expansion signals and competitive intel per group
  const intelMeetings = await sql`
    SELECT group_id, expansion_signals, competitive_intel
    FROM ds_meetings
    WHERE group_id = ANY(${groupIds})
      AND (expansion_signals != '' OR competitive_intel != '')
    ORDER BY date DESC
  `;

  const expansionMap: Record<string, string[]> = {};
  const competitiveMap: Record<string, string[]> = {};
  for (const m of intelMeetings) {
    if (m.expansion_signals) {
      if (!expansionMap[m.group_id]) expansionMap[m.group_id] = [];
      const signals = m.expansion_signals.split("\n").filter(Boolean);
      for (const s of signals) {
        if (!expansionMap[m.group_id].includes(s)) expansionMap[m.group_id].push(s);
      }
    }
    if (m.competitive_intel) {
      if (!competitiveMap[m.group_id]) competitiveMap[m.group_id] = [];
      const intel = m.competitive_intel.split("\n").filter(Boolean);
      for (const i of intel) {
        if (!competitiveMap[m.group_id].includes(i)) competitiveMap[m.group_id].push(i);
      }
    }
  }

  const dossiers = groups.map((g: any) => ({
    group_id: g.id,
    group_name: g.name,
    company: g.company,
    meeting_count: meetingCountMap[g.id] || 0,
    champion_count: championCountMap[g.id] || 0,
    open_actions: openActionMap[g.id] || 0,
    sentiment: sentimentMap[g.id] || "neutral",
    expansion_signals: expansionMap[g.id] || [],
    competitive_intel: competitiveMap[g.id] || [],
  }));

  // Only include dossiers that have some activity
  const activeDossiers = dossiers.filter(
    (d) => d.meeting_count > 0 || d.champion_count > 0 || d.expansion_signals.length > 0 || d.competitive_intel.length > 0
  );

  return NextResponse.json({ dossiers: activeDossiers });
}
