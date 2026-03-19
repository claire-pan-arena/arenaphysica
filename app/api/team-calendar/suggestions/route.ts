import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
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
  events: { title: string; date: string }[];
}

// Patterns that indicate an office/conference room, not travel
const OFFICE_PATTERNS = [
  /arena\s*(hq|physica|ai)/i,
  /\bwest\s*wing\b/i,
  /\beast\s*wing\b/i,
  /\btetris\b/i,
  /\bconf(erence)?\s*room\b/i,
  /\bmeeting\s*room\b/i,
  /\broom\s*\d/i,
  /\bfloor\s*\d/i,
  /\blobby\b/i,
  /\bkitchen\b/i,
  /\bcafeteria\b/i,
];

// Virtual meeting patterns
const VIRTUAL_PATTERNS = [
  /^https?:\/\//,
  /zoom\.us/i,
  /meet\.google/i,
  /teams\.microsoft/i,
  /whereby\.com/i,
];

function isOfficeOrVirtual(location: string, summary: string): boolean {
  const loc = location || "";
  // Virtual
  if (VIRTUAL_PATTERNS.some((p) => p.test(loc))) return true;
  // Office room
  if (OFFICE_PATTERNS.some((p) => p.test(loc) || p.test(summary))) return true;
  return false;
}

// Extract "City, State" from a full address.
// "19800 MacArthur Blvd, Irvine, CA 92612" -> "Irvine, California"
// "Ritz-Carlton, 1 Miramontes Point Rd, Half Moon Bay, CA 94019, USA" -> "Half Moon Bay, California"
// "123 Main St, Austin, TX" -> "Austin, Texas"
function extractCity(location: string): string | null {
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length < 2) return null;

  // Strip trailing country
  if (/^(usa|us|united\s*states)$/i.test(parts[parts.length - 1])) {
    parts.pop();
  }
  if (parts.length < 2) return null;

  // Walk backwards to find a state abbreviation, then grab the city before it
  for (let i = parts.length - 1; i >= 1; i--) {
    const cleaned = parts[i].replace(/\d{5}(-\d{4})?/g, "").trim();
    const fullState = STATE_MAP[cleaned.toUpperCase()];
    if (!fullState) continue;

    // Found state — look for city in preceding parts
    for (let j = i - 1; j >= 0; j--) {
      const candidate = parts[j].trim();
      // Skip street addresses (start with number) and short fragments
      if (/^\d/.test(candidate) || candidate.length <= 2) continue;
      return `${candidate}, ${fullState}`;
    }
  }

  // No state found — try "City, Country" or just return best guess
  if (parts.length === 2) {
    const [a, b] = parts;
    if (/^\d/.test(a)) return b;
    return `${a}, ${b}`;
  }

  return null;
}

const STATE_MAP: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "Washington, DC",
};

// Known city aliases — use word-boundary matching to avoid false positives
// (e.g. "la" should not match "Plaza" or "Place")
const CITY_ALIASES: [RegExp, string][] = [
  [/\blos\s*angeles\b/i, "Los Angeles, California"],
  [/\blax\b/i, "Los Angeles, California"],
  [/\bsan\s*francisco\b/i, "San Francisco, California"],
  [/\bsfo\b/i, "San Francisco, California"],
  [/\bnew\s*york\b/i, "New York, New York"],
  [/\bnyc\b/i, "New York, New York"],
  [/\bjfk\b/i, "New York, New York"],
  [/\birvine\b/i, "Irvine, California"],
  [/\bcosta\s*mesa\b/i, "Costa Mesa, California"],
  [/\bchicago\b/i, "Chicago, Illinois"],
  [/\bseattle\b/i, "Seattle, Washington"],
  [/\baustin\b/i, "Austin, Texas"],
  [/\bboston\b/i, "Boston, Massachusetts"],
  [/\bwashington\b/i, "Washington, DC"],
  [/\bmiami\b/i, "Miami, Florida"],
  [/\bdenver\b/i, "Denver, Colorado"],
  [/\batlanta\b/i, "Atlanta, Georgia"],
  [/\bdallas\b/i, "Dallas, Texas"],
  [/\bhouston\b/i, "Houston, Texas"],
  [/\bphoenix\b/i, "Phoenix, Arizona"],
  [/\bportland\b/i, "Portland, Oregon"],
  [/\bsan\s*diego\b/i, "San Diego, California"],
  [/\bsan\s*jose\b/i, "San Jose, California"],
  [/\bdetroit\b/i, "Detroit, Michigan"],
];

// Events that are social/internal, not travel
const SOCIAL_PATTERNS = [
  /happy\s*hour/i,
  /team\s*lunch/i,
  /team\s*dinner/i,
  /team\s*outing/i,
  /birthday/i,
  /celebration/i,
  /party/i,
  /drinks/i,
  /karaoke/i,
  /bowling/i,
  /game\s*night/i,
];

function normalizeToCity(location: string): string | null {
  // Check known city aliases with word-boundary matching
  for (const [pattern, city] of CITY_ALIASES) {
    if (pattern.test(location)) return city;
  }

  // Try to extract city from address
  const extracted = extractCity(location);
  if (extracted) return extracted;

  return null;
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
  const travelEvents: { event: CalendarEvent; city: string; date: string; endDate: string }[] = [];

  for (const event of events) {
    const summary = event.summary || "";
    const location = event.location || "";

    // Skip virtual, office, and social events
    if (!location || isOfficeOrVirtual(location, summary)) continue;
    if (SOCIAL_PATTERNS.some((p) => p.test(summary))) continue;

    // Resolve to a city
    const city = normalizeToCity(location);
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
      travelEvents.push({
        event,
        city,
        date: startStr,
        endDate: endStr || startStr,
      });
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

    // Merge events within 2 days of each other into a single trip
    const trips: { start: string; end: string; events: { title: string; date: string }[] }[] = [];
    let currentTrip: (typeof trips)[0] | null = null;

    for (const ev of cityEvents) {
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
        id: `sug-${city}-${trip.start}`,
        location: city,
        startDate: trip.start,
        endDate: trip.end,
        events: trip.events,
      });
    }
  }

  suggestions.sort((a, b) => a.startDate.localeCompare(b.startDate));

  return NextResponse.json({ suggestions });
}
