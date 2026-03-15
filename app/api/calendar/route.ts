import { auth } from "@/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 401 });
  }

  const now = new Date();
  const endOfWeek = new Date(now);
  const daysUntilSunday = 7 - now.getDay();
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: endOfWeek.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "30",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch calendar" },
      { status: res.status }
    );
  }

  const data = await res.json();

  const events = (data.items || []).map((event: any) => {
    const startDate = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : event.start?.date
        ? new Date(event.start.date)
        : new Date();

    return {
      title: event.summary || "Untitled",
      time: event.start?.dateTime
        ? startDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : "All day",
      date: startDate.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      }),
      location: event.location || null,
      attendees: event.attendees?.length || 0,
    };
  });

  return NextResponse.json({ events });
}
