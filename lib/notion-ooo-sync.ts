const NOTION_DATABASE_ID = process.env.NOTION_OOO_DATABASE_ID || "28ad2b7c-4049-8055-8e3a-cbe87e8d033e";

interface NotionOOOEntry {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  note: string;
}

export async function fetchNotionOOOEntries(): Promise<{ entries: NotionOOOEntry[]; error?: string }> {
  const token = process.env.NOTION_API_KEY_CAL;
  if (!token) return { entries: [], error: "NOTION_API_KEY_CAL not set" };

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
      const text = await res.text();
      return { entries, error: `Notion API ${res.status}: ${text.slice(0, 200)}` };
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

  return { entries };
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function syncNotionOOO(
  sql: any
): Promise<{ synced: number; skipped: number; total: number; error?: string; names?: string[] }> {
  const { entries: oooEntries, error } = await fetchNotionOOOEntries();
  if (error) return { synced: 0, skipped: 0, total: 0, error };
  if (oooEntries.length === 0) return { synced: 0, skipped: 0, total: 0 };

  // Get team members to match by name
  const members = await sql`SELECT email, name FROM team_members`;
  const nameToEmail: Record<string, string> = {};
  const nameToFullName: Record<string, string> = {};
  // Track first names that appear more than once to avoid ambiguous matches
  const firstNameCount: Record<string, number> = {};
  for (const m of members) {
    const firstName = m.name.toLowerCase().split(" ")[0];
    firstNameCount[firstName] = (firstNameCount[firstName] || 0) + 1;
  }
  for (const m of members) {
    const lower = m.name.toLowerCase();
    nameToEmail[lower] = m.email;
    nameToFullName[lower] = m.name;
    const firstName = lower.split(" ")[0];
    // Only allow first-name matching if the first name is unique
    if (firstNameCount[firstName] === 1) {
      nameToEmail[firstName] = m.email;
      nameToFullName[firstName] = m.name;
    }
  }

  // Clear all existing Notion OOO entries to prevent stale/mismatched data
  await sql`DELETE FROM team_calendar_entries WHERE source = 'notion_ooo'`;

  let synced = 0;
  let skipped = 0;
  const skippedNames: string[] = [];

  // Also build a last-name lookup for ambiguous first names
  const lastNameToEmail: Record<string, string> = {};
  const lastNameToFullName: Record<string, string> = {};
  for (const m of members) {
    const parts = m.name.toLowerCase().split(" ");
    if (parts.length > 1) {
      const lastName = parts[parts.length - 1];
      lastNameToEmail[lastName] = m.email;
      lastNameToFullName[lastName] = m.name;
    }
  }

  for (const entry of oooEntries) {
    const nameLower = entry.name.toLowerCase().trim();
    let email = nameToEmail[nameLower] || nameToEmail[nameLower.split(" ")[0]];
    // If first-name match failed (ambiguous), try last name from the Notion entry
    if (!email) {
      const notionParts = nameLower.split(" ");
      if (notionParts.length > 1) {
        const notionLast = notionParts[notionParts.length - 1];
        email = lastNameToEmail[notionLast];
      }
    }
    if (!email) {
      skipped++;
      if (!skippedNames.includes(entry.name)) skippedNames.push(entry.name);
      continue;
    }
    const fullName = nameToFullName[nameLower] || nameToFullName[nameLower.split(" ")[0]] || lastNameToFullName[nameLower.split(" ").pop() || ""] || entry.name;

    const d = new Date(entry.startDate + "T12:00:00");
    const end = new Date(entry.endDate + "T12:00:00");

    while (d <= end) {
      const dateStr = formatDate(d);
      const id = `notion-ooo-${email}-${dateStr}`;

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

  return { synced, skipped, total: oooEntries.length, names: skippedNames.length > 0 ? skippedNames : undefined };
}
