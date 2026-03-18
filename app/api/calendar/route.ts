import { auth } from "@/auth";
import { NextResponse } from "next/server";

const DEV_MOCK_EVENTS = [
  { title: "Team Standup", time: "9:00 AM", date: "Monday, Mar 17", isoDate: "2026-03-17", location: null, attendees: 5 },
  { title: "Anduril Sync", time: "11:00 AM", date: "Monday, Mar 17", isoDate: "2026-03-17", location: "Zoom", attendees: 3 },
  { title: "Product Review", time: "2:00 PM", date: "Tuesday, Mar 18", isoDate: "2026-03-18", location: null, attendees: 8 },
  { title: "AMD Partnership Call", time: "10:00 AM", date: "Wednesday, Mar 19", isoDate: "2026-03-19", location: "Google Meet", attendees: 4 },
];

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "development") {
    return NextResponse.json({ events: DEV_MOCK_EVENTS });
  }

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const sessionError = (session as any).error;
  if (!accessToken || sessionError === "RefreshTokenError") {
    return NextResponse.json({ error: "reauth", message: "Session expired — please sign out and back in" }, { status: 401 });
  }

  // Resolve the user's IANA timezone from the query param, fall back to UTC
  const { searchParams } = new URL(request.url);
  const timeZone = searchParams.get("tz") || "UTC";

  const now = new Date();

  // Compute end-of-week boundary in the user's local timezone
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const localWeekday = dayNames.indexOf(
    new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(now)
  );
  const daysUntilSunday = localWeekday === 0 ? 0 : 7 - localWeekday;
  const endOfWeek = new Date(now);
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
    if (res.status === 401) {
      return NextResponse.json({ error: "reauth", message: "Calendar token expired — please sign out and back in" }, { status: 401 });
    }
    const errorBody = await res.text();
    return NextResponse.json(
      { error: "Failed to fetch calendar", detail: errorBody },
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

    // Format time and date in the user's local timezone
    const localTime = event.start?.dateTime
      ? startDate.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone,
        })
      : "All day";

    const localDate = startDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone,
    });

    // Build isoDate in the user's timezone (not UTC) to avoid date-boundary issues.
    // en-CA locale reliably formats as YYYY-MM-DD.
    const isoDate = startDate.toLocaleDateString("en-CA", { timeZone });

    return {
      title: event.summary || "Untitled",
      time: localTime,
      date: localDate,
      isoDate,
      location: event.location || null,
      attendees: event.attendees?.length || 0,
    };
  });

  return NextResponse.json({ events });
}
