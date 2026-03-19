import { isOfficeOrVirtual, isSocialEvent, normalizeToCity, extractCityFromSummary } from "@/lib/city-utils";
import { getAccessTokenForUser } from "@/lib/google-service-account";

interface SyncMember {
  email: string;
  name: string;
  refresh_token?: string;
  [key: string]: any;
}

async function getAccessTokenViaRefresh(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token;
  } catch {
    return null;
  }
}

export async function syncMemberCalendar(
  sql: any,
  member: SyncMember,
  homeBase: string,
  start: Date,
  end: Date,
  weekStart: string
): Promise<boolean> {
  // Try service account first, fall back to refresh token
  let accessToken = await getAccessTokenForUser(member.email);
  if (!accessToken && member.refresh_token) {
    accessToken = await getAccessTokenViaRefresh(member.refresh_token);
  }
  if (!accessToken) return false;

  try {
    const params = new URLSearchParams({
      timeMin: start.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "200",
    });

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!calRes.ok) return false;

    const calData = await calRes.json();
    const events = calData.items || [];

    // Clear old synced entries for this user in this date range
    await sql`
      DELETE FROM team_calendar_entries
      WHERE user_email = ${member.email}
      AND source = 'google_calendar'
      AND date >= ${weekStart}
      AND date < ${end.toISOString().split("T")[0]}
    `;

    // Collect one entry per date+city (deduplicate multiple events at same location)
    const dateCityMap: Map<string, string> = new Map();

    for (const event of events) {
      const summary = event.summary || "";
      const location = event.location || "";

      // Skip virtual, office, and social events
      if (location && isOfficeOrVirtual(location, summary)) continue;
      if (isSocialEvent(summary)) continue;

      // Resolve to city name from location, or from summary pattern like "Claire in LA"
      const city = normalizeToCity(location) || extractCityFromSummary(summary);
      if (!city) continue;

      // Skip home base
      const cityLower = city.toLowerCase();
      if (cityLower.includes(homeBase) || homeBase.includes(cityLower.split(",")[0].toLowerCase())) {
        continue;
      }

      // Get the date(s) this event covers
      const eventStart = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date)
          : null;
      const eventEnd = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(event.end.date)
          : null;

      if (!eventStart) continue;

      const dates: string[] = [];
      if (eventEnd && event.start?.date) {
        // All-day event — end date is exclusive
        const d = new Date(eventStart);
        while (d < eventEnd) {
          dates.push(d.toISOString().split("T")[0]);
          d.setDate(d.getDate() + 1);
        }
      } else {
        dates.push(eventStart.toISOString().split("T")[0]);
      }

      for (const date of dates) {
        const key = `${date}|${city}`;
        if (!dateCityMap.has(key)) {
          dateCityMap.set(key, city);
        }
      }
    }

    // Insert one entry per date+city
    for (const [key, city] of dateCityMap) {
      const date = key.split("|")[0];
      const id = `tce-g-${member.email}-${date}-${city.replace(/[^a-zA-Z0-9]/g, "")}`;
      await sql`
        INSERT INTO team_calendar_entries (id, user_email, user_name, date, location, entry_type, note, source)
        VALUES (${id}, ${member.email}, ${member.name}, ${date}, ${city}, 'travel', '', 'google_calendar')
        ON CONFLICT (id) DO UPDATE SET
          location = EXCLUDED.location
      `;
    }

    return true;
  } catch {
    return false;
  }
}
