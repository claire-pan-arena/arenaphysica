import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const { customer, weekStart, templateId } = await request.json();
  if (!customer?.trim()) {
    return NextResponse.json({ error: "Customer required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  // Get meeting notes for this customer (optionally filtered by week)
  let notes;
  if (weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    notes = await sql`
      SELECT * FROM meeting_notes
      WHERE customer = ${customer}
        AND event_date >= ${weekStart}
        AND event_date < ${weekEnd.toISOString().split("T")[0]}
      ORDER BY created_at ASC
    `;
  } else {
    notes = await sql`
      SELECT * FROM meeting_notes
      WHERE customer = ${customer}
      ORDER BY created_at DESC LIMIT 20
    `;
  }

  if (notes.length === 0) {
    return NextResponse.json({ error: "No meeting notes found for this customer" }, { status: 400 });
  }

  // Get template if specified
  let templateContent = "";
  if (templateId) {
    const tmpl = await sql`SELECT content FROM report_templates WHERE id = ${templateId}`;
    if (tmpl.length > 0) {
      templateContent = tmpl[0].content;
    }
  }

  const notesText = notes.map((n: any) =>
    `[${n.event_date || "no date"}] ${n.event_title || "Note"}: ${n.content}`
  ).join("\n\n");

  const systemPrompt = `You are a report writer for Arena Physica. Generate a professional meeting report from the provided meeting notes.${
    templateContent
      ? `\n\nUse this template structure:\n${templateContent}`
      : "\n\nStructure the report with: Executive Summary, Key Discussion Points, Action Items, Next Steps."
  }

Keep the report concise, professional, and actionable. Use bullet points for action items.`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Customer: ${customer}\n\nMeeting Notes:\n${notesText}` }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: "AI request failed", detail: err }, { status: 500 });
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || "No report generated.";

  // Save the report
  const id = `report-${Date.now()}`;
  await sql`
    INSERT INTO meeting_reports (id, customer, week_start, template_id, content, creator_email, creator_name)
    VALUES (${id}, ${customer.trim()}, ${weekStart || ""}, ${templateId || null}, ${content}, ${session.user.email}, ${session.user.name || "Unknown"})
  `;

  return NextResponse.json({ id, content });
}
