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

const IMPORT_STEP1_PROMPT = `You are in NOTION IMPORT MODE, STEP 1: Extract & Ask Questions.

You MUST:
1. Extract from the Notion content: people (name, role), meeting date, meeting type, topics discussed, action items (with owners if identifiable), sentiment (infer from tone), expansion signals (mentions of wanting more, new use cases), competitive intel (mentions of competitors)
2. Present what you found in a structured format with headers and bullet points
3. Ask SPECIFIC targeted questions — do NOT ask open-ended questions:
   - "Which deployment does this belong to?" — list the user's existing deployments
   - For each new person NOT already in the dashboard: "Should I create a profile for [Name] ([Role])? Is this person a champion?"
   - If the meeting date is ambiguous or missing: "What date was this meeting?"
   - "Any context about these contacts not in the notes? (communication preferences, personal interests, things to avoid)"
4. Do NOT output any action blocks or structured data blocks. You are gathering information only.
5. At the END of your response, output a \`\`\`questions block with structured UI elements. The frontend renders these as interactive dropdowns, buttons, and text inputs. Format:
\`\`\`questions
[{"id":"deployment","label":"Which deployment does this belong to?","type":"select","options":[LIST_DEPLOYMENTS_HERE],"allow_custom":true,"custom_placeholder":"+ Create new deployment..."},{"id":"person_NAME","label":"Create profile for NAME (ROLE)?","type":"buttons","options":[{"value":"yes","label":"Yes, create"},{"value":"champion","label":"Yes + Champion"},{"value":"skip","label":"Skip"}]},{"id":"date_confirm","label":"Meeting date: DATE — correct?","type":"buttons","options":[{"value":"yes","label":"Correct"},{"value":"no","label":"Different date"}]},{"id":"tribal","label":"Any tribal knowledge about these contacts?","type":"text","placeholder":"e.g., Parker prefers Slack, Zak loves fishing..."}]
\`\`\`
Populate the deployment options using the user's actual deployment IDs and names from the dashboard state.

## Hard Rules
- Every meeting MUST have a date. If you can't find one, ASK.
- Every meeting MUST have at least one attendee. If none found, ASK.
- Deployment assignment is MANDATORY.
- Cross-reference people found in the notes with the dashboard's existing people list.
- Always ask about tribal knowledge for new contacts.`;

const IMPORT_STEP2_PROMPT = `You are in NOTION IMPORT MODE, STEP 2: Present Final Summary + Structured Data.

The user has answered your questions from Step 1. Their answers are in the latest message.

You MUST:
1. Present a clean summary of EXACTLY what will be saved:
   - 📋 **Meeting**: [date], [type], [deployment name], sentiment: [value]
   - 👥 **People to create**: [list with name, role, champion status]
   - 👥 **People to update**: [list of existing people being updated]
   - ✅ **Action items**: [list with owners]
   - 📝 **Topics**: [list]
   - 📈 **Expansion signals**: [list] (or "None detected")
   - 🔍 **Competitive intel**: [list] (or "None detected")

2. At the END of your response, output a \`\`\`import_data block with ALL the structured data. This is critical — the frontend reads this to save the data. Format:
\`\`\`import_data
{"deployment_id":"ACTUAL_DEPLOYMENT_ID","meeting":{"date":"YYYY-MM-DD","type":"weekly_sync|qbr|ad_hoc|kickoff|internal|executive","sentiment":"positive|neutral|negative","notes":"FULL RAW NOTION CONTENT HERE","competitive_intel":["signal1","signal2"],"expansion_signals":["signal1","signal2"]},"people":[{"name":"Full Name","role":"Role","company":"Company","is_champion":false,"fun_fact":"","notes":""}],"action_items":[{"text":"Action item text","owner":"Owner name"}],"topics":["Topic 1","Topic 2"]}
\`\`\`

CRITICAL: Use ACTUAL deployment IDs from the dashboard state (e.g., "ds-dep-1234567890"), not placeholder text. Include ALL people the user confirmed (where answer was "yes" or "champion"). Set is_champion=true for people marked as champion. Include the FULL raw Notion page content in meeting.notes. Do NOT include the \`\`\`import_data block markers inside the JSON — just the raw JSON object.

3. Tell the user: "Click **Confirm Save** below to save this to the dashboard."

## Hard Rules
- Preserve the FULL raw Notion content in meeting.notes
- Use real deployment IDs, not placeholders
- Include all confirmed people, action items, topics, signals`;

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

          // Always track imports when Notion content is present
          const isImport = true;
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
  const isImportMode = mode === "import" || !!notionContext;

  // ── Import step: explicitly passed from frontend (no regex guessing) ──
  const importStep = body.import_step || (isImportMode ? 1 : undefined);

  // ── Build system prompt ──
  let systemPrompt = DS_GUIDE_EXCERPT;

  if (isOnboarding) {
    systemPrompt += `\n\n${ONBOARDING_PROMPT}`;
  } else if (isImportMode && importStep === 1) {
    systemPrompt += `\n\n${IMPORT_STEP1_PROMPT}`;
  } else if (isImportMode && importStep === 2) {
    systemPrompt += `\n\n${IMPORT_STEP2_PROMPT}`;
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
    let reply = data.content?.[0]?.text || "I couldn't generate a response.";

    // Parse questions block from Claude's response (for interactive UI)
    let questions: any[] = [];
    const questionsMatch = reply.match(/```questions\s*\n([\s\S]*?)```/);
    if (questionsMatch) {
      try {
        questions = JSON.parse(questionsMatch[1]);
      } catch {}
      reply = reply.replace(/```questions\s*\n[\s\S]*?```/, "").trim();
    }

    // Parse import_data block from Claude's response (for Step 2 confirmation)
    let import_data: any = null;
    const importDataMatch = reply.match(/```import_data\s*\n([\s\S]*?)```/);
    if (importDataMatch) {
      try {
        import_data = JSON.parse(importDataMatch[1]);
        if (importId) import_data.import_id = importId;
      } catch {}
      reply = reply.replace(/```import_data\s*\n[\s\S]*?```/, "").trim();
    }

    return NextResponse.json({
      reply,
      mode: isOnboarding ? "onboarding" : isImportMode ? "import" : "chat",
      import_id: importId || undefined,
      import_step: importStep || undefined,
      has_notion_context: !!notionContext,
      questions: questions.length > 0 ? questions : undefined,
      import_data: import_data || undefined,
    });
  } catch (e: any) {
    console.error("[copilot] Error:", e.message);
    return NextResponse.json({
      reply: `Co-Pilot error: ${e.message}. Make sure ANTHROPIC_API_KEY is set correctly.`,
    });
  }
}
