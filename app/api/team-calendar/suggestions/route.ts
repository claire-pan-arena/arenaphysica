import { auth } from "@/auth";
import { NextResponse } from "next/server";

const TRAVEL_KEYWORDS = /travel|flight|fly|hotel|visit|onsite|on-site|offsite|off-site|trip|airport/i;

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
  events: { title: string; date: string }[];
}

function extractCity(location: string): string {
  // Strip street addresses, keep city-level info
  // Common patterns: "123 Main St, Irvine, CA" -> "Irvine, CA"
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length >= 3) {
    // Likely "street, city, state" — return city + state
    return parts.slice(1).join(", ");
  }
  if (parts.length === 2) {
    // Could be "city, state" or "street, city"
    // If first part has numbers, it's probably a street
    if (/\d/.test(parts[0])) return parts[1];
    return location;
  }
  return location;
}

function normalizeLocation(loc: string): string {
  const lower = loc.toLowerCase().trim();
  // Map common variations to canonical names
  const cityMap: Record<string, string> = {
    "los angeles": "Los Angeles",
    "la": "Los Angeles",
    "lax": "Los Angeles",
    "san francisco": "San Francisco",
    "sf": "San Francisco",
    "sfo": "San Francisco",
    "new york": "New York",
    "nyc": "New York",
    "jfk": "New York",
    "irvine": "Irvine, CA",
    "chicago": "Chicago",
    "ord": "Chicago",
    "seattle": "Seattle",
    "sea": "Seattle",
    "austin": "Austin",
    "boston": "Boston",
    "washington": "Washington, DC",
    "dc": "Washington, DC",
  };

  for (const [key, val] of Object.entries(cityMap)) {
    if (lower.includes(key)) return val;
  }

  return extractCity(loc);
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

  // Fetch 90 days of calendar events
  const now = new Date();
  const lookAhead = new Date(now);
  lookAhead.setDate(now.getDate() + 90);

  let events: CalendarEvent[] = [];
  try {
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: lookAhead.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "200",
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

  // Find events that suggest travel
  const travelEvents: { event: CalendarEvent; location: string; date: string; endDate: string }[] = [];

  for (const event of events) {
    const summary = event.summary || "";
    const location = event.location || "";

    let travelLocation = "";

    // Has a physical location (not a URL like Zoom/Meet)
    if (location && !location.match(/^https?:\/\//)) {
      travelLocation = normalizeLocation(location);
    }
    // Title contains travel keywords
    else if (TRAVEL_KEYWORDS.test(summary)) {
      travelLocation = summary;
    }

    if (!travelLocation) continue;

    const startStr = event.start?.dateTime
      ? event.start.dateTime.split("T")[0]
      : event.start?.date || "";
    const endStr = event.end?.dateTime
      ? event.end.dateTime.split("T")[0]
      : event.end?.date || "";

    if (startStr) {
      travelEvents.push({
        event,
        location: travelLocation,
        date: startStr,
        endDate: endStr || startStr,
      });
    }
  }

  // Group by normalized location and merge overlapping/adjacent dates
  const locationGroups: Record<string, typeof travelEvents> = {};
  for (const te of travelEvents) {
    const key = te.location;
    if (!locationGroups[key]) locationGroups[key] = [];
    locationGroups[key].push(te);
  }

  const suggestions: TravelSuggestion[] = [];

  for (const [location, events] of Object.entries(locationGroups)) {
    // Sort by date
    events.sort((a, b) => a.date.localeCompare(b.date));

    // Merge events within 2 days of each other into a single trip
    const trips: { start: string; end: string; events: { title: string; date: string }[] }[] = [];
    let currentTrip: (typeof trips)[0] | null = null;

    for (const ev of events) {
      if (!currentTrip) {
        currentTrip = {
          start: ev.date,
          end: ev.endDate,
          events: [{ title: ev.event.summary || "Untitled", date: ev.date }],
        };
      } else {
        const lastEnd = new Date(currentTrip.end);
        const thisStart = new Date(ev.date);
        const gap = (thisStart.getTime() - lastEnd.getTime()) / (1000 * 60 * 60 * 24);

        if (gap <= 2) {
          // Merge
          if (ev.endDate > currentTrip.end) currentTrip.end = ev.endDate;
          currentTrip.events.push({ title: ev.event.summary || "Untitled", date: ev.date });
        } else {
          trips.push(currentTrip);
          currentTrip = {
            start: ev.date,
            end: ev.endDate,
            events: [{ title: ev.event.summary || "Untitled", date: ev.date }],
          };
        }
      }
    }
    if (currentTrip) trips.push(currentTrip);

    for (const trip of trips) {
      suggestions.push({
        id: `sug-${location}-${trip.start}`,
        location,
        startDate: trip.start,
        endDate: trip.end,
        events: trip.events,
      });
    }
  }

  // Sort by start date
  suggestions.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return NextResponse.json({ suggestions });
}
