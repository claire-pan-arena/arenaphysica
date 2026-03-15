import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const { request: travelRequest, refine, previousResult } = await request.json();
  if (!travelRequest?.trim()) {
    return NextResponse.json({ error: "Travel request required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  const prefRows = await sql`SELECT * FROM travel_preferences WHERE user_email = ${session.user.email}`;
  const prefs = prefRows[0];

  let prefsContext = "";
  if (prefs) {
    const parts = [];
    if (prefs.preferred_airlines) parts.push(`Airlines: ${prefs.preferred_airlines}`);
    if (prefs.preferred_airports) parts.push(`Home airports: ${prefs.preferred_airports}`);
    if (prefs.preferred_hotels) parts.push(`Hotels: ${prefs.preferred_hotels}`);
    if (prefs.seat_preference) parts.push(`Seat: ${prefs.seat_preference}`);
    if (prefs.time_preference) parts.push(`Times: ${prefs.time_preference}`);
    if (prefs.loyalty_programs) parts.push(`Loyalty: ${prefs.loyalty_programs}`);
    if (prefs.other_notes) parts.push(`Notes: ${prefs.other_notes}`);
    if (parts.length > 0) prefsContext = `\nPreferences: ${parts.join(". ")}`;
  }

  const userMessage = refine
    ? `Original trip: ${travelRequest}\n\nCurrent itinerary:\n${previousResult}\n\nChange requested: ${refine}`
    : travelRequest;

  const systemPrompt = `You are an AI executive travel planner. The user is busy and needs to book NOW. Search the web for real options.

Return ONLY a valid JSON object — no other text, no markdown, no explanation. The JSON must match this exact schema:

{
  "summary": "Short trip label, e.g. NYC → LA, Mar 17-19",
  "timeline": "Brief logistics: e.g. Depart 8am, land 11:30am, 45min drive, arrive meeting 1pm",
  "flights_out": [
    {"airline":"Delta","route":"JFK → LAX","depart":"8:00am","arrive":"11:30am","price":"$129","url":"https://www.delta.com","recommended":true}
  ],
  "flights_back": [
    {"airline":"Delta","route":"LAX → JFK","depart":"6:00pm","arrive":"2:30am+1","price":"$139","url":"https://www.delta.com","recommended":false}
  ],
  "hotels": [
    {"name":"Marriott Irvine","price":"$189/night","nights":2,"total":"$378","distance":"5 min to meeting","url":"https://www.marriott.com","recommended":true}
  ],
  "transport": "Rental car ~$45/day or Uber ~$65 each way",
  "total_estimate": "$650-850"
}

Rules:
- Search for REAL current prices and availability
- URLs must go to the airline or hotel site DIRECTLY (delta.com, united.com, marriott.com, hilton.com). NEVER aggregators.
- Mark the best option as "recommended":true based on user preferences
- Account for travel time, traffic, check-in — make sure they arrive on time
- 2-3 flight options each way, 2-3 hotel options
- Keep it minimal — no fluff${prefsContext}

Today: ${new Date().toISOString().split("T")[0]}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: systemPrompt,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }],
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "AI request failed", detail: err }, { status: 500 });
  }

  const data = await res.json();

  // Extract text blocks and find JSON
  let jsonStr = "";
  for (const block of data.content || []) {
    if (block.type === "text") {
      jsonStr += block.text;
    }
  }

  // Try to extract JSON from the response
  let itinerary;
  try {
    // Try direct parse first
    itinerary = JSON.parse(jsonStr.trim());
  } catch {
    // Try to find JSON within the text
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        itinerary = JSON.parse(jsonMatch[0]);
      } catch {
        // Return raw text as fallback
        return NextResponse.json({ id: `tp-${Date.now()}`, fallback: jsonStr });
      }
    } else {
      return NextResponse.json({ id: `tp-${Date.now()}`, fallback: jsonStr });
    }
  }

  const id = `tp-${Date.now()}`;
  await sql`
    INSERT INTO travel_plans (id, request, result, creator_email, creator_name)
    VALUES (${id}, ${travelRequest.trim()}, ${JSON.stringify(itinerary)}, ${session.user.email}, ${session.user.name || "Unknown"})
  `;

  return NextResponse.json({ id, itinerary });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const plans = await sql`SELECT * FROM travel_plans WHERE creator_email = ${session.user.email} ORDER BY created_at DESC LIMIT 10`;

  return NextResponse.json({
    plans: plans.map((p: any) => {
      let itinerary = null;
      try { itinerary = JSON.parse(p.result); } catch {}
      return {
        id: p.id,
        request: p.request,
        itinerary,
        createdAt: p.created_at,
      };
    }),
  });
}
