import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  // Get companies this user has access to (via their deployments)
  const deployments = await sql`
    SELECT DISTINCT company, company_id FROM ds_deployments
    WHERE owner_email = ${session.user.email} AND company IS NOT NULL AND company != ''
  `;

  // For each unique company, gather stats
  const companyMap: Record<string, any> = {};
  for (const dep of deployments) {
    const name = dep.company;
    if (!companyMap[name]) {
      companyMap[name] = {
        id: dep.company_id || `company-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        name,
        deployment_count: 0,
        people_count: 0,
      };
    }
    companyMap[name].deployment_count++;
  }

  // Get people counts per company
  const allDeps = await sql`SELECT id, company FROM ds_deployments WHERE owner_email = ${session.user.email}`;
  const depIds = allDeps.map((d: any) => d.id);
  if (depIds.length > 0) {
    const groups = await sql`SELECT id, deployment_id FROM ds_groups WHERE deployment_id = ANY(${depIds})`;
    const groupIds = groups.map((g: any) => g.id);
    if (groupIds.length > 0) {
      const peopleCounts = await sql`
        SELECT g.deployment_id, COUNT(p.id) as cnt
        FROM ds_people p
        JOIN ds_groups g ON p.group_id = g.id
        WHERE g.id = ANY(${groupIds})
        GROUP BY g.deployment_id
      `;
      for (const pc of peopleCounts) {
        const dep = allDeps.find((d: any) => d.id === pc.deployment_id);
        if (dep && companyMap[dep.company]) {
          companyMap[dep.company].people_count += parseInt(pc.cnt);
        }
      }
    }
  }

  return NextResponse.json({
    companies: Object.values(companyMap),
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, notes } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();
  const id = `ds-co-${Date.now()}`;

  await sql`
    INSERT INTO ds_companies (id, name, owner_email, notes)
    VALUES (${id}, ${name.trim()}, ${session.user.email}, ${notes || ""})
  `;

  return NextResponse.json({ id, name: name.trim() });
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, notes } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const sql = getDb();
  await initDb();

  await sql`
    UPDATE ds_companies SET
      name = COALESCE(${name ?? null}, name),
      notes = COALESCE(${notes ?? null}, notes),
      updated_at = NOW()
    WHERE id = ${id} AND owner_email = ${session.user.email}
  `;

  return NextResponse.json({ success: true });
}
