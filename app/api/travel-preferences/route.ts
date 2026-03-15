import { auth } from "@/auth";
import { getDb, initDb } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  await initDb();

  const rows = await sql`SELECT * FROM travel_preferences WHERE user_email = ${session.user.email}`;

  if (rows.length === 0) {
    return NextResponse.json({ preferences: null });
  }

  const p = rows[0];
  return NextResponse.json({
    preferences: {
      preferredAirlines: p.preferred_airlines,
      preferredAirports: p.preferred_airports,
      preferredHotels: p.preferred_hotels,
      seatPreference: p.seat_preference,
      timePreference: p.time_preference,
      loyaltyPrograms: p.loyalty_programs,
      otherNotes: p.other_notes,
      homeBase: p.home_base || "NYC",
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const sql = getDb();
  await initDb();

  await sql`
    INSERT INTO travel_preferences (user_email, preferred_airlines, preferred_airports, preferred_hotels, seat_preference, time_preference, loyalty_programs, other_notes, home_base, updated_at)
    VALUES (
      ${session.user.email},
      ${body.preferredAirlines || ""},
      ${body.preferredAirports || ""},
      ${body.preferredHotels || ""},
      ${body.seatPreference || ""},
      ${body.timePreference || ""},
      ${body.loyaltyPrograms || ""},
      ${body.otherNotes || ""},
      ${body.homeBase || "NYC"},
      NOW()
    )
    ON CONFLICT (user_email) DO UPDATE SET
      preferred_airlines = EXCLUDED.preferred_airlines,
      preferred_airports = EXCLUDED.preferred_airports,
      preferred_hotels = EXCLUDED.preferred_hotels,
      seat_preference = EXCLUDED.seat_preference,
      time_preference = EXCLUDED.time_preference,
      loyalty_programs = EXCLUDED.loyalty_programs,
      other_notes = EXCLUDED.other_notes,
      home_base = EXCLUDED.home_base,
      updated_at = NOW()
  `;

  return NextResponse.json({ ok: true });
}
