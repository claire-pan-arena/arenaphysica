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

  // Team members — stores refresh tokens for team calendar sync
  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      refresh_token TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`;

  // Team calendar entries — manual + Google Calendar synced
  await sql`
    CREATE TABLE IF NOT EXISTS team_calendar_entries (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_name TEXT NOT NULL,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'travel',
      note TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      google_event_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Customer tags for team calendar
  await sql`
    CREATE TABLE IF NOT EXISTS team_calendar_customers (
      name TEXT PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await sql`INSERT INTO team_calendar_customers (name) VALUES ('Apex'), ('Mercury'), ('Bellatrix') ON CONFLICT DO NOTHING`;
  await sql`ALTER TABLE team_calendar_entries ADD COLUMN IF NOT EXISTS customer TEXT DEFAULT ''`;

  // ── DS Dashboard tables ──────────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS ds_companies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_deployments (
      id TEXT PRIMARY KEY,
      company TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      start_date TEXT,
      health TEXT NOT NULL DEFAULT 'green',
      notes TEXT DEFAULT '',
      owner_email TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Phase 0 migrations: add name and company_id to deployments
  await sql`ALTER TABLE ds_deployments ADD COLUMN IF NOT EXISTS name TEXT DEFAULT ''`;
  await sql`ALTER TABLE ds_deployments ADD COLUMN IF NOT EXISTS company_id TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_groups (
      id TEXT PRIMARY KEY,
      deployment_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      health TEXT NOT NULL DEFAULT 'green',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_people (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT '',
      company TEXT DEFAULT '',
      is_champion BOOLEAN DEFAULT FALSE,
      sentiment TEXT DEFAULT 'neutral',
      email TEXT DEFAULT '',
      fun_fact TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      last_contact TEXT,
      reports_to TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Phase 4 migration: add company_id to people
  await sql`ALTER TABLE ds_people ADD COLUMN IF NOT EXISTS company_id TEXT`;

  // People/Groups refactor: add deployment_id, make group_id optional
  await sql`ALTER TABLE ds_people ADD COLUMN IF NOT EXISTS deployment_id TEXT`;
  await sql`ALTER TABLE ds_people ALTER COLUMN group_id DROP NOT NULL`;
  await sql`ALTER TABLE ds_meetings ADD COLUMN IF NOT EXISTS deployment_id TEXT`;
  await sql`ALTER TABLE ds_meetings ALTER COLUMN group_id DROP NOT NULL`;

  // Backfill deployment_id from group chain for existing records
  await sql`UPDATE ds_people SET deployment_id = (SELECT deployment_id FROM ds_groups WHERE ds_groups.id = ds_people.group_id) WHERE deployment_id IS NULL AND group_id IS NOT NULL`;
  await sql`UPDATE ds_meetings SET deployment_id = (SELECT deployment_id FROM ds_groups WHERE ds_groups.id = ds_meetings.group_id) WHERE deployment_id IS NULL AND group_id IS NOT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_workstreams (
      id TEXT PRIMARY KEY,
      group_id TEXT,
      name TEXT NOT NULL,
      owner TEXT DEFAULT '',
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'p1',
      start_date TEXT,
      due_date TEXT,
      description TEXT DEFAULT '',
      is_internal BOOLEAN DEFAULT FALSE,
      linked_deployment_id TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_tasks (
      id TEXT PRIMARY KEY,
      workstream_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'todo',
      owner TEXT DEFAULT '',
      due_date TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_meetings (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      date TEXT NOT NULL,
      type TEXT DEFAULT 'Weekly Check-in',
      agenda_sent BOOLEAN DEFAULT FALSE,
      recap_sent BOOLEAN DEFAULT FALSE,
      sentiment TEXT DEFAULT 'neutral',
      notes TEXT DEFAULT '',
      competitive_intel TEXT DEFAULT '',
      expansion_signals TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_meeting_attendees (
      meeting_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      PRIMARY KEY (meeting_id, person_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_meeting_action_items (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      text TEXT NOT NULL,
      done BOOLEAN DEFAULT FALSE,
      owner TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_meeting_topics (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_weekly_snapshots (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      week_of TEXT NOT NULL,
      reflections TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ds_weekly_snapshot_items (
      id TEXT PRIMARY KEY,
      snapshot_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      priority TEXT DEFAULT 'p1',
      notes TEXT DEFAULT ''
    )
  `;

  // ── Notion Import tracking ──
  await sql`
    CREATE TABLE IF NOT EXISTS ds_notion_imports (
      id TEXT PRIMARY KEY,
      notion_url TEXT NOT NULL,
      notion_page_id TEXT NOT NULL,
      raw_content TEXT NOT NULL,
      extracted_data JSONB,
      status TEXT DEFAULT 'pending',
      target_deployment_id TEXT,
      target_group_id TEXT,
      owner_email TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // DS settings table
  await sql`
    CREATE TABLE IF NOT EXISTS ds_settings (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_email, key)
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
