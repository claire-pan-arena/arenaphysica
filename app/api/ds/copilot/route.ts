import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { fetchNotionPageContent, extractNotionUrls } from "@/lib/notion";
import { NextRequest, NextResponse } from "next/server";

const DS_GUIDE_EXCERPT = `You are the DS Co-Pilot for Arena's Deployment Strategist Operating System.
You assist Deployment Strategists — the most important role in enterprise AI.
The single KPI is usage. Everything a DS does exists to drive adoption of Atlas within the customer.

Core DS responsibilities: run weekly check-ins (agenda 24h before, recap within 24h), run demos,
know the data, befriend users (name, role, team, pain points, fun fact), navigate the customer org,
unblock other teams, author PRDs, own customer support, hunt for expansion opportunities.

Be concise — this is a side panel. Give actionable, data-grounded responses.
When you notice risks (stale contacts >7 days, overdue tasks, declining sentiment), mention them proactively.`;

const ONBOARDING_PROMPT = `You are in ONBOARDING MODE. The DS has no deployments yet. Your job is to interview them and help set up their dashboard.

Guide them through this flow conversationally:
1. Ask how many customer deployments they're currently managing
2. For each deployment, gather: name, company, current health (green/yellow/red), status (prospect/alpha/beta/pilot/scaling/fully_deployed)
3. For each deployment, ask about key contacts: name, role, whether they're a champion
4. Ask if they have Notion pages with meeting notes they'd like to import
5. Proactively ask for tribal knowledge: "Any context about these contacts that isn't written anywhere? (e.g., communication preferences, personal interests, things to avoid)"

Be warm, efficient, and conversational. Don't dump everything at once — ask 1-2 questions at a time.
When you have enough info to create a deployment, tell the user you're ready to create it and ask for confirmation.

IMPORTANT: When you gather enough data to create entities, output a JSON block wrapped in \`\`\`json tags that the frontend can parse and use to make API calls. Format:
\`\`\`json
{"action":"create_deployment","data":{"name":"...","company":"...","health":"green","status":"pilot"}}
\`\`\`
or for people:
\`\`\`json
{"action":"create_people","data":{"deployment_id":"...","group_name":"...","people":[{"name":"...","role":"...","is_champion":false}]}}
\`\`\``;

const IMPORT_PROMPT = `You are in NOTION IMPORT MODE. The DS has shared a Notion page. Your job is to extract structured data from it.

## Hard Rules
1. Every meeting MUST have a date. If you can't determine it from the title or content, ASK.
2. Every meeting MUST have at least one external stakeholder attendee. Identify them and ask the DS to confirm.
3. The full raw notes must be preserved — you're extracting structure ON TOP of the raw notes, not replacing them.
4. If you can't determine which deployment this belongs to, ASK. Include a "+ Add New Deployment" option.
5. Proactively ask: "Any context about these contacts that isn't in the notes? (e.g., communication preferences, personal interests, things to avoid)"

## What to Extract
- **People**: name, role, company (from context), whether they seem like a champion
- **Meeting date**: from title, content, or ask
- **Meeting type**: kickoff, weekly_sync, qbr, ad_hoc, internal, executive
- **Sentiment**: positive, neutral, negative (infer from tone)
- **Topics**: main discussion points
- **Action items**: with owner if identifiable
- **Expansion signals**: mentions of wanting more, new use cases, etc.
- **Competitive intel**: mentions of competitors, alternative solutions

Present your extraction as a structured summary and ask clarifying questions.
When the DS confirms, output a JSON block that the frontend can parse:
\`\`\`json
{"action":"save_import","data":{"import_id":"...","deployment_id":"...","group_id":"...","meeting":{...},"people":[...],"action_items":[...],"topics":[...]}}
\`\`\``;

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

  const body = await request.json();
  const { message, conversation_history, mode } = body;
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
    // Use deployment_id directly for people and meetings (supports ungrouped records)
    people = await sql`SELECT * FROM ds_people WHERE deployment_id = ANY(${depIds})`;
    meetings = await sql`SELECT * FROM ds_meetings WHERE deployment_id = ANY(${depIds}) ORDER BY date DESC LIMIT 20`;
    const gIds = groups.map((g: any) => g.id);
    if (gIds.length > 0) {
      workstreams = await sql`SELECT * FROM ds_workstreams WHERE group_id = ANY(${gIds})`;
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
    deployments: deployments.map((d: any) => ({ id: d.id, name: d.name, company: d.company, health: d.health, status: d.status })),
    groups: groups.map((g: any) => ({ id: g.id, deployment_id: g.deployment_id, name: g.name, health: g.health })),
    people: people.map((p: any) => ({ id: p.id, name: p.name, role: p.role, group_id: p.group_id, is_champion: p.is_champion, sentiment: p.sentiment, last_contact: p.last_contact })),
    workstreams: [...workstreams, ...internalWs].map((w: any) => ({ id: w.id, name: w.name, status: w.status, priority: w.priority, due_date: w.due_date })),
    tasks: tasks.map((t: any) => ({ id: t.id, title: t.title, status: t.status, due_date: t.due_date })),
    recentMeetings: meetings.map((m: any) => ({ id: m.id, date: m.date, group_id: m.group_id, type: m.type, sentiment: m.sentiment })),
  });

  // ── Detect Notion URLs and fetch content ──
  const notionUrls = extractNotionUrls(message);
  let notionContext = "";
  let importId = "";

  if (notionUrls.length > 0) {
    const notionApiKey = process.env.NOTION_API_KEY;
    if (notionApiKey) {
      for (const url of notionUrls.slice(0, 3)) { // Max 3 pages
        try {
          const { pageId, title, content } = await fetchNotionPageContent(url);

          // Track import if in import mode or if the message looks like an import request
          const isImport = mode === "import" || /import|upload|ingest|add.*notes/i.test(message);
          if (isImport) {
            importId = `ds-imp-${Date.now()}`;
            await sql`
              INSERT INTO ds_notion_imports (id, notion_url, notion_page_id, raw_content, status, owner_email)
              VALUES (${importId}, ${url}, ${pageId}, ${content}, 'pending', ${userEmail})
            `;
          }

          notionContext += `\n\n## Notion Page: "${title}"\n${content}\n`;
        } catch (e: any) {
          notionContext += `\n\n[Failed to fetch Notion page ${url}: ${e.message}]\n`;
        }
      }
    } else {
      notionContext = "\n\n[Notion integration is not configured. Ask your admin to add NOTION_API_KEY to the environment.]\n";
    }
  }

  // ── Determine mode ──
  const isOnboarding = deployments.length === 0 && !notionContext;
  const isImportMode = mode === "import" || (notionContext && /import|upload|ingest|add.*notes/i.test(message));

  // ── Build system prompt ──
  let systemPrompt = DS_GUIDE_EXCERPT;

  if (isOnboarding) {
    systemPrompt += `\n\n${ONBOARDING_PROMPT}`;
  } else if (isImportMode) {
    systemPrompt += `\n\n${IMPORT_PROMPT}`;
  }

  systemPrompt += `\n\nYou are assisting ${userName} (${userEmail}).`;
  systemPrompt += `\n\n## Current Dashboard State\n${context}`;

  if (notionContext) {
    systemPrompt += `\n\n## Notion Page Content\nThe user shared Notion page(s). Here is the content:\n---${notionContext}\n---`;
    if (importId) {
      systemPrompt += `\n\nImport ID for this Notion page: ${importId}`;
    }
  }

  if (!isOnboarding && !isImportMode) {
    systemPrompt += `\n\n## Instructions
- Answer questions by synthesizing from the data above
- Be proactive: flag risks (stale contacts >7 days, overdue tasks, declining sentiment)
- Be concise — short, actionable responses for a side panel
- Reference specific people, deployments, and dates from the data
- If no data exists yet, guide the user to add their first deployment
- If the user shares a Notion link, you can read and answer questions about its content`;
  }

  // ── Build messages array (with conversation history) ──
  const messages: { role: "user" | "assistant"; content: string }[] = [];

  if (conversation_history && Array.isArray(conversation_history)) {
    for (const msg of conversation_history.slice(-20)) { // Keep last 20 messages for context
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.text || msg.content || "" });
      }
    }
  }

  messages.push({ role: "user", content: message.trim() });

  try {
    // Try preferred model, fall back if unavailable
    const MODELS = ["claude-sonnet-4-20250514"];
    let lastError = "";
    let apiRes: Response | null = null;

    for (const model of MODELS) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        }),
      });

      if (res.ok) {
        apiRes = res;
        break;
      }
      lastError = await res.text();
      console.error(`[copilot] API error with model ${model}:`, lastError);
    }

    if (!apiRes) {
      return NextResponse.json({
        reply: `Co-Pilot API error: ${lastError.slice(0, 300)}. Check that your ANTHROPIC_API_KEY is valid and has access to the requested model.`,
      });
    }

    const data = await apiRes.json();
    const reply = data.content?.[0]?.text || "I couldn't generate a response.";

    return NextResponse.json({
      reply,
      mode: isOnboarding ? "onboarding" : isImportMode ? "import" : "chat",
      import_id: importId || undefined,
      has_notion_context: !!notionContext,
    });
  } catch (e: any) {
    console.error("[copilot] Error:", e.message);
    return NextResponse.json({
      reply: `Co-Pilot error: ${e.message}. Make sure ANTHROPIC_API_KEY is set correctly.`,
    });
  }
}
