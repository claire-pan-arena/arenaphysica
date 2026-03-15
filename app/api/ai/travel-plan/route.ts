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

  const { request: travelRequest } = await request.json();
  if (!travelRequest?.trim()) {
    return NextResponse.json({ error: "Travel request required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Get user preferences
  const prefRows = await sql`SELECT * FROM travel_preferences WHERE user_email = ${session.user.email}`;
  const prefs = prefRows[0];

  let prefsContext = "";
  if (prefs) {
    const parts = [];
    if (prefs.preferred_airlines) parts.push(`Preferred airlines: ${prefs.preferred_airlines}`);
    if (prefs.preferred_airports) parts.push(`Preferred airports: ${prefs.preferred_airports}`);
    if (prefs.preferred_hotels) parts.push(`Preferred hotels: ${prefs.preferred_hotels}`);
    if (prefs.seat_preference) parts.push(`Seat preference: ${prefs.seat_preference}`);
    if (prefs.time_preference) parts.push(`Time preference: ${prefs.time_preference}`);
    if (prefs.loyalty_programs) parts.push(`Loyalty programs: ${prefs.loyalty_programs}`);
    if (prefs.other_notes) parts.push(`Other notes: ${prefs.other_notes}`);
    if (parts.length > 0) {
      prefsContext = `\n\nUser's travel preferences:\n${parts.join("\n")}`;
    }
  }

  const systemPrompt = `You are a travel planning assistant for Arena Physica. You MUST use web search to find real, current flight and hotel options.

For the user's trip request:
1. Search for actual flights on the relevant routes — include airline, flight times, and prices. Link ONLY to the airline's own website (e.g. united.com, delta.com, aa.com, southwest.com). Do NOT link to aggregators like Google Flights, Kayak, Expedia, etc.
2. Search for hotels near the meeting/destination — include hotel name, nightly rate, and distance to meeting location. Link ONLY to the hotel's own booking site (e.g. marriott.com, hilton.com, hyatt.com). Do NOT link to booking.com, hotels.com, Expedia, etc.
3. Search for ground transportation options with costs

Format your response EXACTLY like this structure. Keep each list item on ONE line. Do NOT use pipe characters or break items across multiple lines:

## Flights

### Outbound
- **Delta JFK to LAX** — Departs 8:00am, arrives 11:30am — **$129 one-way** — [Book on delta.com](https://www.delta.com)
- **United EWR to LAX** — Departs 9:15am, arrives 12:40pm — **$149 one-way** — [Book on united.com](https://www.united.com)

### Return
- Same format as above

## Hotels
- **Marriott Irvine Spectrum** — **$189/night** — 5 min from meeting location — [Book on marriott.com](https://www.marriott.com)
- **Hilton Irvine** — **$169/night** — 10 min drive — [Book on hilton.com](https://www.hilton.com)

## Ground Transport
- Rental car from LAX: approximately **$45/day** from major providers
- Uber/Lyft from LAX to Irvine: approximately **$60-80**

## Recommended Itinerary
A short paragraph explaining the best combination and why.

RULES:
- Each bullet must be ONE line — never split a bullet across lines
- Only link to airline and hotel websites directly — NO aggregators (no Google Flights, Kayak, Expedia, booking.com, hotels.com)
- Bold all prices with ** markers
- Keep it concise — no filler text between sections
- Prioritize the user's preferences when ranking options${prefsContext}

Today's date is ${new Date().toISOString().split("T")[0]}.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: systemPrompt,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 10,
        },
      ],
      messages: [{ role: "user", content: travelRequest }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "AI request failed", detail: err }, { status: 500 });
  }

  const data = await res.json();

  // Extract text blocks from the response (web search results are interleaved)
  const textParts: string[] = [];
  for (const block of data.content || []) {
    if (block.type === "text") {
      textParts.push(block.text);
    }
  }
  const content = textParts.join("\n\n") || "No response generated.";

  // Save the plan
  const id = `tp-${Date.now()}`;
  await sql`
    INSERT INTO travel_plans (id, request, result, creator_email, creator_name)
    VALUES (${id}, ${travelRequest.trim()}, ${content}, ${session.user.email}, ${session.user.name || "Unknown"})
  `;

  return NextResponse.json({ id, result: content });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const plans = await sql`SELECT * FROM travel_plans WHERE creator_email = ${session.user.email} ORDER BY created_at DESC LIMIT 20`;

  return NextResponse.json({
    plans: plans.map((p: any) => ({
      id: p.id,
      request: p.request,
      result: p.result,
      createdAt: p.created_at,
    })),
  });
}
