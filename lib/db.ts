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

  // Seed default tools (upsert so new tools get added to existing DBs)
  await sql`INSERT INTO tools (id, name, description, creator_email, creator_name, category) VALUES
    ('meeting-report', 'Generate Meeting Report', 'Summarize notes and action items from your last meeting', 'system@arena-ai.com', 'Arena Physica', 'Productivity'),
    ('customer-crm', 'View Customer CRM', 'Access customer profiles, deal stages, and engagement history', 'system@arena-ai.com', 'Arena Physica', 'Sales'),
    ('deployment-tracker', 'Deployment Tracker', 'Monitor active field deployments and hardware status', 'system@arena-ai.com', 'Arena Physica', 'Operations'),
    ('design-canvas', 'Design Canvas', 'Open the RF design workspace for hardware modeling', 'system@arena-ai.com', 'Arena Physica', 'Engineering'),
    ('travel-organizer', 'Travel Organizer', 'Plan and organize travel logistics for customer visits and events', 'system@arena-ai.com', 'Arena Physica', 'Productivity'),
    ('weekly-agenda', 'Weekly Agenda Generator', 'Generate a structured weekly agenda from your calendar and action items', 'system@arena-ai.com', 'Arena Physica', 'Productivity')
  ON CONFLICT (id) DO NOTHING`;
}
