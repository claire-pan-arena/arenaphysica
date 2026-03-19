import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json({ error: "No access token" }, { status: 400 });
  }

  const { location, startDate, endDate, forName } = await request.json();
  if (!location || !startDate || !endDate) {
    return NextResponse.json({ error: "location, startDate, endDate required" }, { status: 400 });
  }

  // Extract state/country from location for the event title
  const parts = location.split(",").map((s: string) => s.trim());
  const region = parts.length > 1 ? parts[parts.length - 1] : location;
  const fullName = forName || session.user.name || "Someone";
  const firstName = fullName.split(" ")[0];
  const summary = `${firstName} in ${region}`;

  // Use all-day event format: endDate needs to be the day AFTER the last day
  const endPlusOne = new Date(endDate + "T12:00:00");
  endPlusOne.setDate(endPlusOne.getDate() + 1);
  const endDateExclusive = endPlusOne.toISOString().split("T")[0];

  const event = {
    summary,
    start: { date: startDate },
    end: { date: endDateExclusive },
    transparency: "transparent", // Don't block time
  };

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(process.env.TEAM_CALENDAR_ID || "primary")}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Google API ${res.status}: ${text.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ eventId: data.id, summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
