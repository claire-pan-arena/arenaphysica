const NOTION_DATABASE_ID = process.env.NOTION_OOO_DATABASE_ID || "28ad2b7c-4049-8055-8e3a-cbe87e8d033e";

interface NotionOOOEntry {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  note: string;
}

export async function fetchNotionOOOEntries(): Promise<NotionOOOEntry[]> {
  const token = process.env.NOTION_API_KEY_CALENDAR;
  if (!token) return [];

  const entries: NotionOOOEntry[] = [];
  let hasMore = true;
  let startCursor: string | undefined;

  while (hasMore) {
    const body: any = {
      filter: {
        and: [
          {
            property: "What dates are you OOO for? ",
            date: { is_not_empty: true },
          },
        ],
      },
      sorts: [
        { property: "What dates are you OOO for? ", direction: "ascending" },
      ],
      page_size: 100,
    };
    if (startCursor) body.start_cursor = startCursor;

    const res = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      console.error("Notion OOO query failed:", res.status, await res.text());
      return entries;
    }

    const data = await res.json();

    for (const page of data.results) {
      const props = page.properties;

      const nameTitle = props["Name"]?.title;
      const name = nameTitle?.map((t: any) => t.plain_text).join("") || "";

      const dateProperty = props["What dates are you OOO for? "]?.date;
      if (!dateProperty?.start) continue;

      const startDate = dateProperty.start.split("T")[0];
      const endDate = dateProperty.end ? dateProperty.end.split("T")[0] : startDate;

      const status = props["Status"]?.status?.name || "";
      const noteRichText = props["Please feel free to include any other important information"]?.rich_text;
      const note = noteRichText?.map((t: any) => t.plain_text).join("") || "";

      entries.push({ name, startDate, endDate, status, note });
    }

    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return entries;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function syncNotionOOO(
  sql: any,
  rangeStart?: Date,
  rangeEnd?: Date
): Promise<{ synced: number; skipped: number }> {
  const oooEntries = await fetchNotionOOOEntries();
  if (oooEntries.length === 0) return { synced: 0, skipped: 0 };

  // Get team members to match by name
  const members = await sql`SELECT email, name FROM team_members`;
  const nameToEmail: Record<string, string> = {};
  const nameToFullName: Record<string, string> = {};
  for (const m of members) {
    // Match by first name (lowercase) and full name
    const lower = m.name.toLowerCase();
    nameToEmail[lower] = m.email;
    nameToFullName[lower] = m.name;
    const firstName = lower.split(" ")[0];
    if (!nameToEmail[firstName]) {
      nameToEmail[firstName] = m.email;
      nameToFullName[firstName] = m.name;
    }
  }

  let synced = 0;
  let skipped = 0;

  for (const entry of oooEntries) {
    // Match name to team member
    const nameLower = entry.name.toLowerCase().trim();
    const email = nameToEmail[nameLower] || nameToEmail[nameLower.split(" ")[0]];
    if (!email) {
      skipped++;
      continue;
    }
    const fullName = nameToFullName[nameLower] || nameToFullName[nameLower.split(" ")[0]] || entry.name;

    // Create entries for each day in the range
    const d = new Date(entry.startDate + "T12:00:00");
    const end = new Date(entry.endDate + "T12:00:00");

    while (d <= end) {
      const dateStr = formatDate(d);

      // Skip dates outside the requested range
      if (rangeStart && d < rangeStart) { d.setDate(d.getDate() + 1); continue; }
      if (rangeEnd && d > rangeEnd) break;

      const id = `notion-ooo-${email}-${dateStr}`;

      // Upsert: insert or update
      await sql`
        INSERT INTO team_calendar_entries (id, user_email, user_name, date, location, entry_type, note, source)
        VALUES (${id}, ${email}, ${fullName}, ${dateStr}, ${"OOO"}, ${"ooo"}, ${entry.note || ""}, ${"notion_ooo"})
        ON CONFLICT (id) DO UPDATE SET
          location = EXCLUDED.location,
          entry_type = EXCLUDED.entry_type,
          note = EXCLUDED.note,
          source = EXCLUDED.source
      `;
      synced++;

      d.setDate(d.getDate() + 1);
    }
  }

  return { synced, skipped };
}
