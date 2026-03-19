import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  const sessionError = (session as any).error;
  if (!accessToken || sessionError === "RefreshTokenError") {
    return NextResponse.json(
      { error: "reauth", message: "Calendar access expired — please sign out and back in to re-authorize." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const timeZone = searchParams.get("tz") || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const daysAhead = parseInt(searchParams.get("days") || "14", 10);
  const includePast = searchParams.get("past") === "true";

  const now = new Date();
  const timeMin = includePast
    ? new Date(now.getTime() - 7 * 86400000) // 7 days ago
    : now;
  const timeMax = new Date(now.getTime() + daysAhead * 86400000);

  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json(
          { error: "reauth", message: "Calendar token expired — please sign out and back in." },
          { status: 401 }
        );
      }
      const errText = await res.text();
      return NextResponse.json({ error: "calendar_error", detail: errText }, { status: res.status });
    }

    const data = await res.json();

    // Load DS people for matching attendees
    const sql = getDb();
    await initDb();
    const deployments = await sql`SELECT * FROM ds_deployments WHERE owner_email = ${session.user.email}`;
    const depIds = deployments.map((d: any) => d.id);
    let dsPeople: any[] = [];
    if (depIds.length > 0) {
      dsPeople = await sql`SELECT id, name, email, deployment_id, is_champion FROM ds_people WHERE deployment_id = ANY(${depIds})`;
    }

    // Build email→person and name→person maps for matching
    const emailMap: Record<string, any> = {};
    const nameMap: Record<string, any> = {};
    for (const p of dsPeople) {
      if (p.email) emailMap[p.email.toLowerCase()] = p;
      if (p.name) nameMap[p.name.toLowerCase()] = p;
    }

    // Build deployment lookup
    const depMap: Record<string, any> = {};
    for (const d of deployments) {
      depMap[d.id] = d;
    }

    // Check which meetings are already logged (by date + rough attendee match)
    let loggedMeetings: any[] = [];
    if (depIds.length > 0) {
      loggedMeetings = await sql`SELECT id, date, deployment_id FROM ds_meetings WHERE deployment_id = ANY(${depIds})`;
    }
    const loggedDates = new Set(loggedMeetings.map((m: any) => m.date));

    const arenaEmailDomain = "@arena-ai.com";

    const events = (data.items || []).map((event: any) => {
      const startDate = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date)
          : new Date();

      const isoDate = startDate.toLocaleDateString("en-CA", { timeZone });

      const localTime = event.start?.dateTime
        ? startDate.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
            timeZone,
          })
        : "All day";

      const localDate = startDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone,
      });

      // Process attendees
      const attendees: { email: string; name: string; isExternal: boolean; personId?: string; isChampion?: boolean }[] = [];
      let hasExternal = false;
      for (const att of (event.attendees || [])) {
        const email = (att.email || "").toLowerCase();
        const displayName = att.displayName || email.split("@")[0];
        const isExternal = !email.endsWith(arenaEmailDomain);
        if (isExternal) hasExternal = true;

        // Match to DS people
        const matchedPerson = emailMap[email] || nameMap[displayName.toLowerCase()];

        attendees.push({
          email: att.email || "",
          name: displayName,
          isExternal,
          personId: matchedPerson?.id,
          isChampion: matchedPerson?.is_champion || false,
        });
      }

      // Determine suggested deployment based on attendee matches
      const deploymentMatches: Record<string, number> = {};
      for (const att of attendees) {
        if (att.personId) {
          const person = dsPeople.find((p: any) => p.id === att.personId);
          if (person?.deployment_id) {
            deploymentMatches[person.deployment_id] = (deploymentMatches[person.deployment_id] || 0) + 1;
          }
        }
      }
      const suggestedDeploymentId = Object.entries(deploymentMatches)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const suggestedDeployment = suggestedDeploymentId ? depMap[suggestedDeploymentId] : null;

      const isLogged = loggedDates.has(isoDate);
      const isPast = startDate < now;

      return {
        id: event.id,
        title: event.summary || "Untitled",
        time: localTime,
        date: localDate,
        isoDate,
        location: event.location || event.hangoutLink || null,
        attendees,
        attendeeCount: attendees.length,
        externalCount: attendees.filter((a: any) => a.isExternal).length,
        hasExternal,
        isLogged,
        isPast,
        suggestedDeploymentId,
        suggestedDeploymentName: suggestedDeployment
          ? (suggestedDeployment.name || suggestedDeployment.company)
          : null,
      };
    });

    // Filter to only external meetings (has at least one non-arena attendee)
    const externalEvents = events.filter((e: any) => e.hasExternal);

    return NextResponse.json({
      events: externalEvents,
      allEvents: events,
      totalEvents: events.length,
      externalEvents: externalEvents.length,
    });
  } catch (e: any) {
    console.error("[ds/calendar] Error:", e.message);
    return NextResponse.json({ error: "fetch_error", message: e.message }, { status: 500 });
  }
}
