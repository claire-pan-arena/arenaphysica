import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { isOfficeOrVirtual, isSocialEvent, normalizeToCity, extractCityFromSummary } from "@/lib/city-utils";
import { NextResponse } from "next/server";

interface CalendarEvent {
  id: string;
  summary: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

interface TravelSuggestion {
  id: string;
  location: string;
  startDate: string;
  endDate: string;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json({ suggestions: [] });
  }

  // Get user's home base to exclude it
  const sql = getDb();
  await initDb();
  const prefRows = await sql`SELECT home_base FROM travel_preferences WHERE user_email = ${session.user.email}`;
  const homeBase = (prefRows[0]?.home_base || "NYC").toLowerCase();

  // Only exclude manually confirmed entries (not auto-synced ones)
  const existingEntries = await sql`
    SELECT date, location FROM team_calendar_entries WHERE user_email = ${session.user.email} AND source = 'manual'
  `;
  const confirmedSet = new Set(existingEntries.map((e: any) => `${e.date}|${e.location}`));

  // Fetch up to 1 year of calendar events
  const now = new Date();
  const lookAhead = new Date(now);
  lookAhead.setDate(now.getDate() + 365);

  let events: CalendarEvent[] = [];
  try {
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: lookAhead.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "500",
    });
    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!calRes.ok) {
      return NextResponse.json({ suggestions: [] });
    }
    const calData = await calRes.json();
    events = calData.items || [];
  } catch {
    return NextResponse.json({ suggestions: [] });
  }

  // Find events that suggest travel to a different city
  const travelEvents: { city: string; date: string; endDate: string }[] = [];

  for (const event of events) {
    const summary = event.summary || "";
    const location = event.location || "";

    // Skip virtual, office, and social events
    if (location && isOfficeOrVirtual(location, summary)) continue;
    if (isSocialEvent(summary)) continue;

    // Resolve to a city
    const city = normalizeToCity(location) || extractCityFromSummary(summary);
    if (!city) continue;

    // Skip if it's the user's home base
    const cityLower = city.toLowerCase();
    if (cityLower.includes(homeBase) || homeBase.includes(cityLower.split(",")[0].toLowerCase())) {
      continue;
    }

    const startStr = event.start?.dateTime
      ? event.start.dateTime.split("T")[0]
      : event.start?.date || "";
    const endStr = event.end?.dateTime
      ? event.end.dateTime.split("T")[0]
      : event.end?.date || "";

    if (startStr) {
      travelEvents.push({ city, date: startStr, endDate: endStr || startStr });
    }
  }

  // Group by city and merge overlapping/adjacent dates
  const cityGroups: Record<string, typeof travelEvents> = {};
  for (const te of travelEvents) {
    if (!cityGroups[te.city]) cityGroups[te.city] = [];
    cityGroups[te.city].push(te);
  }

  const suggestions: TravelSuggestion[] = [];

  for (const [city, cityEvents] of Object.entries(cityGroups)) {
    cityEvents.sort((a, b) => a.date.localeCompare(b.date));

    // Merge overlapping or directly adjacent events into a single trip
    const trips: { start: string; end: string }[] = [];
    let currentTrip: { start: string; end: string } | null = null;

    for (const ev of cityEvents) {
      if (!currentTrip) {
        currentTrip = { start: ev.date, end: ev.endDate };
      } else {
        const lastEnd = new Date(currentTrip.end + "T12:00:00");
        const thisStart = new Date(ev.date + "T12:00:00");
        const gap = (thisStart.getTime() - lastEnd.getTime()) / (1000 * 60 * 60 * 24);

        if (gap <= 1) {
          // Overlapping or next day — extend the trip
          if (ev.endDate > currentTrip.end) currentTrip.end = ev.endDate;
        } else {
          trips.push(currentTrip);
          currentTrip = { start: ev.date, end: ev.endDate };
        }
      }
    }
    if (currentTrip) trips.push(currentTrip);

    for (const trip of trips) {
      // Skip if all dates in this trip are already confirmed
      let allConfirmed = true;
      const d = new Date(trip.start + "T12:00:00");
      const endD = new Date(trip.end + "T12:00:00");
      while (d <= endD) {
        const dateStr = d.toISOString().split("T")[0];
        if (!confirmedSet.has(`${dateStr}|${city}`)) {
          allConfirmed = false;
          break;
        }
        d.setDate(d.getDate() + 1);
      }
      if (allConfirmed) continue;

      suggestions.push({
        id: `sug-${city}-${trip.start}`,
        location: city,
        startDate: trip.start,
        endDate: trip.end,
      });
    }
  }

  suggestions.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return NextResponse.json({ suggestions });
}
