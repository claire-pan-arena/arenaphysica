import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const DS_GUIDE_EXCERPT = `You are the DS Co-Pilot for Arena's Deployment Strategist Operating System.
You assist Deployment Strategists — the most important role in enterprise AI.
The single KPI is usage. Everything a DS does exists to drive adoption of Atlas within the customer.

Core DS responsibilities: run weekly check-ins (agenda 24h before, recap within 24h), run demos,
know the data, befriend users (name, role, team, pain points, fun fact), navigate the customer org,
unblock other teams, author PRDs, own customer support, hunt for expansion opportunities.

Be concise — this is a side panel. Give actionable, data-grounded responses.
When you notice risks (stale contacts >7 days, overdue tasks, declining sentiment), mention them proactively.`;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      reply:
        "The Co-Pilot needs an ANTHROPIC_API_KEY environment variable to be set. Please add it to your environment and redeploy.",
    });
  }

  const { message } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();
  const userEmail = session.user.email;
  const userName = session.user.name || "DS";

  // Load user's data context
  const deployments = await sql`SELECT * FROM ds_deployments WHERE owner_email = ${userEmail}`;
  const depIds = deployments.map((d: any) => d.id);

  let groups: any[] = [];
  let people: any[] = [];
  let workstreams: any[] = [];
  let tasks: any[] = [];
  let meetings: any[] = [];

  if (depIds.length > 0) {
    groups = await sql`SELECT * FROM ds_groups WHERE deployment_id = ANY(${depIds})`;
    const gIds = groups.map((g: any) => g.id);
    if (gIds.length > 0) {
      people = await sql`SELECT * FROM ds_people WHERE group_id = ANY(${gIds})`;
      workstreams = await sql`SELECT * FROM ds_workstreams WHERE group_id = ANY(${gIds})`;
      meetings = await sql`SELECT * FROM ds_meetings WHERE group_id = ANY(${gIds}) ORDER BY date DESC LIMIT 20`;
    }
    const wsIds = workstreams.map((w: any) => w.id);
    if (wsIds.length > 0) {
      tasks = await sql`SELECT * FROM ds_tasks WHERE workstream_id = ANY(${wsIds})`;
    }
  }

  const internalWs = depIds.length > 0
    ? await sql`SELECT * FROM ds_workstreams WHERE is_internal = TRUE AND linked_deployment_id = ANY(${depIds})`
    : [];

  const context = JSON.stringify({
    deployments,
    groups,
    people,
    workstreams: [...workstreams, ...internalWs],
    tasks,
    recentMeetings: meetings,
  });

  const systemPrompt = `${DS_GUIDE_EXCERPT}

You are assisting ${userName} (${userEmail}).

## Current State
${context}

## Instructions
- Answer questions by synthesizing from the data above
- Be proactive: flag risks (stale contacts >7 days, overdue tasks, declining sentiment)
- Be concise — short, actionable responses for a side panel
- Reference specific people, deployments, and dates from the data
- If no data exists yet, guide the user to add their first deployment`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: message.trim() }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[copilot] API error:", err);
      return NextResponse.json({
        reply: "Co-Pilot encountered an error. Please try again.",
      });
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text || "I couldn't generate a response.";

    return NextResponse.json({ reply });
  } catch (e: any) {
    console.error("[copilot] Error:", e.message);
    return NextResponse.json({
      reply: `Co-Pilot error: ${e.message}. Make sure ANTHROPIC_API_KEY is set correctly.`,
    });
  }
}
