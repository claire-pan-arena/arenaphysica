import { auth } from "@/auth";
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

  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "No calendar access" }, { status: 401 });
  }

  // Fetch this week's calendar events
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 4); // Friday
  endOfWeek.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    timeMin: startOfWeek.toISOString(),
    timeMax: endOfWeek.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  const calRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  let eventsText = "No calendar events available.";
  if (calRes.ok) {
    const calData = await calRes.json();
    const events = (calData.items || []).map((e: any) => {
      const start = e.start?.dateTime
        ? new Date(e.start.dateTime).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
        : e.start?.date || "TBD";
      const attendees = e.attendees?.length || 0;
      return `- ${start}: ${e.summary || "Untitled"}${attendees > 0 ? ` (${attendees} attendees)` : ""}`;
    });
    if (events.length > 0) {
      eventsText = events.join("\n");
    }
  }

  const systemPrompt = `You are a weekly sync agenda generator for Arena Physica. Based on the calendar events for the week, generate a structured weekly sync agenda.

Include:
1. **Week Overview** — high-level summary of the week's focus
2. **Key Meetings** — important external/customer meetings to prepare for
3. **Internal Syncs** — team meetings and their purpose
4. **Preparation Needed** — what to prepare before key meetings
5. **Discussion Topics** — suggested topics for the team sync

Keep it concise and actionable. Use markdown formatting.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: `This week's calendar:\n${eventsText}` }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "AI request failed", detail: err }, { status: 500 });
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || "No agenda generated.";

  return NextResponse.json({ content });
}
