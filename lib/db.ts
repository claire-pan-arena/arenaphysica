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

  await sql`
    CREATE TABLE IF NOT EXISTS enabled_tools (
      user_email TEXT NOT NULL,
      tool_id TEXT NOT NULL,
      PRIMARY KEY (user_email, tool_id)
    )
  `;

  // Seed default tools if empty
  const existing = await sql`SELECT COUNT(*) as count FROM tools`;
  if (Number(existing[0].count) === 0) {
    await sql`INSERT INTO tools (id, name, description, creator_email, creator_name, category) VALUES
      ('meeting-report', 'Generate Meeting Report', 'Summarize notes and action items from your last meeting', 'system@arena-ai.com', 'Arena Physica', 'Productivity'),
      ('customer-crm', 'View Customer CRM', 'Access customer profiles, deal stages, and engagement history', 'system@arena-ai.com', 'Arena Physica', 'Sales'),
      ('deployment-tracker', 'Deployment Tracker', 'Monitor active field deployments and hardware status', 'system@arena-ai.com', 'Arena Physica', 'Operations'),
      ('design-canvas', 'Design Canvas', 'Open the RF design workspace for hardware modeling', 'system@arena-ai.com', 'Arena Physica', 'Engineering')
    `;
  }
}
