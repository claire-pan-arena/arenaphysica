import { neon } from "@neondatabase/serverless";

export function getDb() {
  return neon(process.env.DATABASE_URL!);
}

export async function initDb() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      creator_email TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      url TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Add private column to existing tools tables
  await sql`ALTER TABLE tools ADD COLUMN IF NOT EXISTS private BOOLEAN NOT NULL DEFAULT FALSE`;

  await sql`
    CREATE TABLE IF NOT EXISTS enabled_tools (
      user_email TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      PRIMARY KEY (user_email, tool_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS kb_notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      creator_email TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      updated_by_email TEXT,
      updated_by_name TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Meeting notes — quick notes tied to a customer/event
  await sql`
    CREATE TABLE IF NOT EXISTS meeting_notes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      customer TEXT NOT NULL,
      event_title TEXT,
      event_date TEXT,
      creator_email TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Meeting report templates
  await sql`
    CREATE TABLE IF NOT EXISTS report_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      creator_email TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Generated meeting reports
  await sql`
    CREATE TABLE IF NOT EXISTS meeting_reports (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      week_start TEXT NOT NULL,
      template_id TEXT,
      content TEXT NOT NULL,
      creator_email TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Travel preferences per user
  await sql`
    CREATE TABLE IF NOT EXISTS travel_preferences (
      user_email TEXT PRIMARY KEY,
      preferred_airlines TEXT DEFAULT '',
      preferred_airports TEXT DEFAULT '',
      preferred_hotels TEXT DEFAULT '',
      seat_preference TEXT DEFAULT '',
      time_preference TEXT DEFAULT '',
      loyalty_programs TEXT DEFAULT '',
      other_notes TEXT DEFAULT '',
      home_base TEXT DEFAULT 'NYC',
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE travel_preferences ADD COLUMN IF NOT EXISTS home_base TEXT DEFAULT 'NYC'`;

  // Travel plans
  await sql`
    CREATE TABLE IF NOT EXISTS travel_plans (
      id TEXT PRIMARY KEY,
      request TEXT NOT NULL,
      result TEXT NOT NULL,
      creator_email TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Migrate enabled_tools from old IDs to new IDs (before deleting old tools)
  await sql`INSERT INTO enabled_tools (user_email, tool_id) SELECT user_email, 'travel-planner' FROM enabled_tools WHERE tool_id = 'travel-organizer' ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO enabled_tools (user_email, tool_id) SELECT user_email, 'weekly-sync' FROM enabled_tools WHERE tool_id = 'weekly-agenda' ON CONFLICT DO NOTHING`;

  // Remove deprecated tools (after migration)
  for (const id of ['design-canvas', 'customer-crm', 'deployment-tracker', 'travel-organizer', 'weekly-agenda']) {
    await sql`DELETE FROM enabled_tools WHERE tool_id = ${id}`;
    await sql`DELETE FROM tools WHERE id = ${id}`;
  }

  // Seed default tools (upsert so new tools get added to existing DBs)
  await sql`INSERT INTO tools (id, name, description, creator_email, creator_name, category) VALUES
    ('meeting-report', 'Meeting Report', 'Generate meeting reports from your notes and action items', 'system@arena-ai.com', 'Arena Physica', 'Productivity'),
    ('travel-planner', 'Travel Planner', 'Plan and organize travel logistics for customer visits and events', 'system@arena-ai.com', 'Arena Physica', 'Productivity'),
    ('weekly-sync', 'Weekly Sync', 'Generate a structured weekly sync agenda from your calendar and action items', 'system@arena-ai.com', 'Arena Physica', 'Productivity')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`;
}
