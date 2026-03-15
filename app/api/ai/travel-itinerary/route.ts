import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const sql = getDb();
  await initDb();

  // Fetch user preferences
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
    if (parts.length > 0) prefsContext = parts.map(p => `- ${p}`).join("\n");
  }

  // Fetch calendar events
  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "Calendar not connected — sign out and back in" }, { status: 400 });
  }

  let calendarEvents: string[] = [];
  try {
    const now = new Date();
    const lookAhead = new Date(now);
    lookAhead.setDate(now.getDate() + 90);
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: lookAhead.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "100",
    });
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (calRes.ok) {
      const calData = await calRes.json();
      calendarEvents = (calData.items || []).map((e: any) => {
        const start = e.start?.dateTime || e.start?.date || "";
        const end = e.end?.dateTime || e.end?.date || "";
        const loc = e.location || "";
        const attendees = (e.attendees || []).map((a: any) => a.email).filter((e: string) => !e.includes("calendar.google.com")).join(", ");
        return `${start} - ${end}: ${e.summary || "Untitled"}${loc ? ` [Location: ${loc}]` : ""}${attendees ? ` [Attendees: ${attendees}]` : ""}`;
      });
    }
  } catch {}

  if (calendarEvents.length === 0) {
    return NextResponse.json({ error: "No calendar events found" }, { status: 400 });
  }

  const systemPrompt = `You are an AI executive travel planner. The user wants a comprehensive internal itinerary generated from their calendar. Analyze their calendar events and identify ALL meetings that require travel (meetings with locations different from the user's home base, offsite meetings, customer visits, etc). Then create a complete travel itinerary covering all upcoming trips.

Calendar events (next 90 days):
${calendarEvents.join("\n")}

Return ONLY a valid JSON object — no other text, no markdown, no explanation. The JSON must match this exact schema:

{
  "home_base": "Best guess of user's home city/airport based on preferences and calendar patterns",
  "trips": [
    {
      "summary": "NYC → LA, Mar 17-19",
      "purpose": "Meeting with Anduril team",
      "dates": "Mar 17-19",
      "meetings": [
        {"title": "Anduril Engineering Sync", "date": "Mar 18", "time": "2:00pm", "location": "Irvine, CA"}
      ],
      "flights_out": [
        {"airline":"Delta","flight_code":"DL1234","date":"Mar 17","route":"JFK → LAX","depart":"8:00am","arrive":"11:30am","price":"$129","url":"https://www.delta.com/flight-search/search?...","recommended":true}
      ],
      "flights_out_note": "LAX is 45 min from Irvine meeting location via I-405.",
      "flights_back": [
        {"airline":"Delta","flight_code":"DL5678","date":"Mar 19","route":"LAX → JFK","depart":"6:00pm","arrive":"2:30am+1","price":"$139","url":"https://www.delta.com/flight-search/search?...","recommended":true}
      ],
      "flights_back_note": "Meeting ends at 3pm. Leave by 4pm for 6pm flight.",
      "hotels": [
        {"name":"Marriott Irvine","price":"$189/night","nights":2,"total":"$378","distance":"5 min to meeting","url":"https://www.marriott.com/search/...","recommended":true}
      ],
      "transport": "Rental car ~$45/day",
      "total_estimate": "$650-850"
    }
  ],
  "no_travel_needed": ["Weekly team standup - virtual", "1:1 with manager - virtual"],
  "total_travel_budget": "$2,500-3,200"
}

Rules:
- Identify which events require travel vs which are virtual/local. List virtual ones in "no_travel_needed" (just event names).
- Group nearby meetings into single trips when possible (e.g. two meetings in the same city on consecutive days = one trip)
- Search for REAL current flights with actual flight codes and dates
- URLs MUST be deep links to booking pages, NOT homepages
- Only include the recommended flight/hotel for each trip (no alternatives needed for the overview)
- NEVER recommend flights that violate user preferences
- Account for travel time, traffic, check-in — make sure they arrive on time
- flights_out_note: distance/drive time from airport to meeting
- flights_back_note: when to leave meeting to catch flight
- If no events require travel, return {"trips": [], "no_travel_needed": [...], "total_travel_budget": "$0"}
- Keep it minimal — no fluff${prefsContext ? `

CRITICAL — User travel preferences (HARD CONSTRAINTS):
${prefsContext}` : ""}

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
      max_tokens: 8000,
      system: systemPrompt,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 20 }],
      messages: [{ role: "user", content: "Generate my complete travel itinerary from my calendar. Find all meetings that require travel and search for real flights and hotels for each trip." }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "AI request failed", detail: err }, { status: 500 });
  }

  const data = await res.json();

  let jsonStr = "";
  for (const block of data.content || []) {
    if (block.type === "text") {
      jsonStr += block.text;
    }
  }
  jsonStr = jsonStr.replace(/<cite[^>]*>/g, "").replace(/<\/cite>/g, "");

  let itinerary;
  try {
    itinerary = JSON.parse(jsonStr.trim());
  } catch {
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        itinerary = JSON.parse(jsonMatch[0]);
      } catch {
        return NextResponse.json({ fallback: jsonStr });
      }
    } else {
      return NextResponse.json({ fallback: jsonStr });
    }
  }

  return NextResponse.json({ itinerary });
}
