"use client";

import { useEffect, useState } from "react";
import NavHeader from "../../components/nav-header";
import Markdown from "../../components/markdown";

interface TravelPreferences {
  preferredAirlines: string;
  preferredAirports: string;
  preferredHotels: string;
  seatPreference: string;
  timePreference: string;
  loyaltyPrograms: string;
  otherNotes: string;
  homeBase: string;
}

interface Flight {
  airline: string;
  flight_code?: string;
  date?: string;
  route: string;
  depart: string;
  arrive: string;
  price: string;
  url: string;
  recommended?: boolean;
}

interface Hotel {
  name: string;
  price: string;
  nights?: number;
  total?: string;
  distance: string;
  url: string;
  recommended?: boolean;
}

interface Itinerary {
  summary: string;
  timeline: string;
  flights_out: Flight[];
  flights_out_note?: string;
  flights_back: Flight[];
  flights_back_note?: string;
  hotels: Hotel[];
  transport: string;
  total_estimate: string;
}

interface CalendarTrip {
  summary: string;
  purpose: string;
  dates: string;
  meetings: { title: string; date: string; time: string; location: string }[];
  flights_out: Flight[];
  flights_out_note?: string;
  flights_back: Flight[];
  flights_back_note?: string;
  hotels: Hotel[];
  transport: string;
  total_estimate: string;
}

interface DayScheduleItem {
  time: string;
  event: string;
  type: "flight" | "meeting" | "travel" | "hotel" | "note";
  detail?: string;
}

interface DaySchedule {
  date: string;
  items: DayScheduleItem[];
}

interface CalendarItinerary {
  home_base: string;
  trips: CalendarTrip[];
  daily_schedule: DaySchedule[];
  no_travel_needed: string[];
  total_travel_budget: string;
}

interface SavedTrip {
  id: string;
  request: string;
  itinerary: Itinerary | null;
  createdAt: string;
}

const EMPTY_PREFS: TravelPreferences = {
  preferredAirlines: "", preferredAirports: "", preferredHotels: "",
  seatPreference: "", timePreference: "", loyaltyPrograms: "", otherNotes: "",
  homeBase: "NYC",
};

export default function TravelPlannerPage() {
  const [prefs, setPrefs] = useState<TravelPreferences>(EMPTY_PREFS);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [request, setRequest] = useState("");
  const [generating, setGenerating] = useState(false);
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [refinement, setRefinement] = useState("");
  const [lastRequest, setLastRequest] = useState("");
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [expandedTrip, setExpandedTrip] = useState<string | null>(null);
  const [showAltFlightsOut, setShowAltFlightsOut] = useState(false);
  const [showAltFlightsBack, setShowAltFlightsBack] = useState(false);
  const [showAltHotels, setShowAltHotels] = useState(false);
  const [calendarItinerary, setCalendarItinerary] = useState<CalendarItinerary | null>(null);
  const [generatingCalendar, setGeneratingCalendar] = useState(false);
  const [expandedCalTrip, setExpandedCalTrip] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/travel-preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) { setPrefs(data.preferences); setSavedPrefs(true); }
        else setShowPrefs(true);
      }).catch(() => {});
    fetch("/api/ai/travel-plan")
      .then((r) => r.json())
      .then((data) => setSavedTrips(data.plans || []))
      .catch(() => {});
  }, []);

  const savePreferences = async () => {
    setSavingPrefs(true);
    await fetch("/api/travel-preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) });
    setSavingPrefs(false); setSavedPrefs(true); setShowPrefs(false);
  };

  const generate = async (refineText?: string) => {
    const isRefine = !!refineText;
    if (!isRefine && !request.trim()) return;
    setGenerating(true);
    if (!isRefine) { setItinerary(null); setFallback(null); setShowAltFlightsOut(false); setShowAltFlightsBack(false); setShowAltHotels(false); }
    try {
      const res = await fetch("/api/ai/travel-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: isRefine ? lastRequest : request.trim(),
          refine: refineText || undefined,
          previousResult: isRefine && itinerary ? JSON.stringify(itinerary) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) { setFallback(`Error: ${data.error}`); }
      else if (data.itinerary) {
        setItinerary(data.itinerary); setFallback(null);
        if (!isRefine) setSavedTrips((prev) => [{ id: data.id, request: request.trim(), itinerary: data.itinerary, createdAt: new Date().toISOString() }, ...prev]);
        else if (savedTrips.length > 0) setSavedTrips((prev) => [{ ...prev[0], itinerary: data.itinerary }, ...prev.slice(1)]);
      } else if (data.fallback) setFallback(data.fallback);
      if (!isRefine) { setLastRequest(request.trim()); setRequest(""); }
      setRefinement("");
    } catch { setFallback("Something went wrong."); }
    setGenerating(false);
  };

  const deleteTrip = async (id: string) => {
    await fetch("/api/ai/travel-plan", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setSavedTrips((prev) => prev.filter((t) => t.id !== id));
  };

  const generateCalendarItinerary = async () => {
    setGeneratingCalendar(true);
    setCalendarItinerary(null);
    try {
      const res = await fetch("/api/ai/travel-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.error) setFallback(`Error: ${data.error}`);
      else if (data.itinerary) setCalendarItinerary(data.itinerary);
      else if (data.fallback) setFallback(data.fallback);
    } catch { setFallback("Failed to generate calendar itinerary."); }
    setGeneratingCalendar(false);
  };

  const recFlight = (flights: Flight[]) => flights.find((f) => f.recommended) || flights[0];
  const altFlights = (flights: Flight[]) => flights.filter((f) => f !== recFlight(flights));
  const recHotel = (hotels: Hotel[]) => hotels.find((h) => h.recommended) || hotels[0];
  const altHotels = (hotels: Hotel[]) => hotels.filter((h) => h !== recHotel(hotels));

  const prefFields: { key: keyof TravelPreferences; label: string; ph: string }[] = [
    { key: "preferredAirlines", label: "Airlines", ph: "United, Delta" },
    { key: "preferredAirports", label: "Airports", ph: "SFO, JFK" },
    { key: "preferredHotels", label: "Hotels", ph: "Marriott, Hilton" },
    { key: "seatPreference", label: "Seat", ph: "Aisle" },
    { key: "timePreference", label: "Times", ph: "Morning flights" },
    { key: "loyaltyPrograms", label: "Loyalty", ph: "United Gold" },
    { key: "otherNotes", label: "Notes", ph: "No red-eyes" },
    { key: "homeBase", label: "Home Base", ph: "NYC" },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="fixed inset-0 bg-gradient-to-b from-[#c5bfb0] via-[#8b9a9e] to-[#2a3040]" />
      <div className="fixed inset-0 bg-black/30" />
      <div className="fixed inset-0" style={{ background: "radial-gradient(ellipse 120% 60% at 50% 80%, rgba(180,160,130,0.3) 0%, transparent 70%)" }} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <svg viewBox="0 0 400 400" className="h-[800px] w-[800px] animate-[spin_30s_linear_infinite] opacity-[0.05]">
          <circle cx="200" cy="200" r="180" fill="none" stroke="white" strokeWidth="0.4" />
          <circle cx="200" cy="200" r="140" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
        </svg>
      </div>

      <div className="relative z-10">
        <NavHeader />

        <div className="px-8 py-8 max-w-3xl mx-auto">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl text-white" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>Travel Planner</h2>
            <div className="flex items-center gap-4">
              <button onClick={generateCalendarItinerary} disabled={generatingCalendar}
                className="text-[10px] tracking-widest text-white/35 uppercase hover:text-white/60 transition-colors disabled:opacity-30 flex items-center gap-1.5">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                {generatingCalendar ? "Generating..." : "Generate from Calendar"}
              </button>
              <button onClick={() => setShowPrefs(!showPrefs)} className="text-[10px] tracking-widest text-white/35 uppercase hover:text-white/60 transition-colors">
                {showPrefs ? "Close" : "Preferences"}
              </button>
            </div>
          </div>

          {/* Preferences */}
          {showPrefs && (
            <div className="mb-5 rounded-xl border border-white/8 bg-white/[0.04] p-4 backdrop-blur-xl">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {prefFields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-0.5 block text-[8px] tracking-widest text-white/25 uppercase">{f.label}</label>
                    <input type="text" value={prefs[f.key]} onChange={(e) => setPrefs((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                      className="w-full rounded-md border border-white/8 bg-white/[0.04] px-2.5 py-1.5 text-[11px] text-white placeholder-white/15 outline-none focus:border-white/15" />
                  </div>
                ))}
              </div>
              <button onClick={savePreferences} disabled={savingPrefs} className="mt-2 text-[9px] tracking-widest text-white/40 uppercase hover:text-white/60 disabled:opacity-40">
                {savingPrefs ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {/* Search / Refine bar */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={itinerary ? refinement : request}
              onChange={(e) => itinerary ? setRefinement(e.target.value) : setRequest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || generating) return;
                if (itinerary && refinement.trim()) generate(refinement.trim());
                else if (!itinerary && request.trim()) generate();
              }}
              placeholder={itinerary ? "Adjust this trip — 'earlier flight', 'closer hotel'..." : "Where do you need to be? 'Anduril in Irvine Tue 2pm, back Wed evening'"}
              autoFocus
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[13px] text-white placeholder-white/20 outline-none focus:border-white/15 backdrop-blur-xl"
            />
            {itinerary ? (
              <>
                <button onClick={() => generate(refinement.trim())} disabled={generating || !refinement.trim()}
                  className="shrink-0 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-[10px] tracking-widest text-white/60 uppercase hover:bg-white/10 disabled:opacity-25 transition-all">
                  {generating ? "..." : "Refine"}
                </button>
                <button onClick={() => { setItinerary(null); setFallback(null); setRefinement(""); }}
                  className="shrink-0 rounded-xl border border-white/8 px-3 py-2.5 text-[10px] tracking-widest text-white/25 uppercase hover:text-white/45 transition-colors">
                  New
                </button>
              </>
            ) : (
              <button onClick={() => generate()} disabled={generating || !request.trim()}
                className="shrink-0 rounded-xl border border-white/15 bg-white/[0.07] px-5 py-2.5 text-[10px] tracking-widest text-white/60 uppercase hover:bg-white/10 disabled:opacity-25 transition-all">
                {generating ? "Searching..." : "Go"}
              </button>
            )}
          </div>

          {/* Loading */}
          {(generating && !itinerary) && (
            <div className="flex items-center justify-center gap-3 py-16">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              <span className="text-[11px] text-white/30">Searching flights and hotels...</span>
            </div>
          )}
          {generatingCalendar && (
            <div className="flex items-center justify-center gap-3 py-16">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/10 border-t-white/40" />
              <span className="text-[11px] text-white/30">Analyzing calendar and searching flights for all trips...</span>
            </div>
          )}

          {/* ═══ Calendar Itinerary ═══ */}
          {calendarItinerary && (
            <div className="mb-8">
              <div className="flex items-baseline justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-white">Upcoming Travel</h3>
                  <p className="text-[11px] text-white/25 mt-0.5">Based on your calendar · Home: {calendarItinerary.home_base}</p>
                  {calendarItinerary.trips.length > 1 && (
                    <span className="text-[12px] text-[#a3b18a]/70">{calendarItinerary.total_travel_budget} estimated total</span>
                  )}
                </div>
                <button onClick={() => setCalendarItinerary(null)} className="text-[9px] tracking-widest text-white/20 uppercase hover:text-white/40 transition-colors">Clear</button>
              </div>

              {calendarItinerary.trips.length === 0 && (
                <p className="text-[12px] text-white/30 py-4">No upcoming trips requiring travel found on your calendar.</p>
              )}

              <div className="flex flex-col gap-3">
                {calendarItinerary.trips.map((trip, idx) => {
                  const isExpanded = expandedCalTrip === idx;
                  const outFlight = trip.flights_out?.[0];
                  const backFlight = trip.flights_back?.[0];
                  const hotel = trip.hotels?.[0];

                  return (
                    <div key={idx} className="rounded-xl border border-white/8 bg-white/[0.04] backdrop-blur-xl overflow-hidden">
                      {/* Trip summary row — always visible */}
                      <button
                        onClick={() => setExpandedCalTrip(isExpanded ? null : idx)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-medium text-white">{trip.summary}</span>
                          </div>
                          <p className="text-[11px] text-white/30 mt-0.5 truncate">{trip.purpose}</p>
                          <span className="text-[11px] text-[#a3b18a]/60">{trip.total_estimate} estimated</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          <svg className={`h-3 w-3 text-white/15 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-4 pb-4 border-t border-white/5 pt-3 flex flex-col gap-3">
                          {/* Meetings */}
                          {trip.meetings && trip.meetings.length > 0 && (
                            <div>
                              <div className="text-[9px] tracking-widest text-white/20 uppercase mb-1.5">Meetings</div>
                              {trip.meetings.map((m, mi) => (
                                <div key={mi} className="flex items-center gap-2 text-[11px] text-white/40 py-0.5">
                                  <span className="text-white/20">{m.date} {m.time}</span>
                                  <span className="text-white/50">{m.title}</span>
                                  {m.location && <span className="text-white/15">· {m.location}</span>}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Outbound */}
                          {outFlight && (
                            <div>
                              <div className="text-[9px] tracking-widest text-white/20 uppercase mb-1.5">Departing Flight{outFlight.date ? ` · ${outFlight.date}` : ""}</div>
                              <BookingRow
                                left={<>
                                  <span className="font-mono text-[11px] text-white/40 w-12">{outFlight.flight_code}</span>
                                  <span className="text-[13px] text-white/80">{outFlight.depart} → {outFlight.arrive}</span>
                                  <span className="text-[11px] text-white/30">{outFlight.route}</span>
                                  <span className="text-[11px] text-white/25">{outFlight.airline}</span>
                                </>}
                                price={outFlight.price}
                                url={outFlight.url}
                                highlight
                              />
                              {trip.flights_out_note && <p className="text-[10px] text-white/20 mt-1 pl-1">{trip.flights_out_note}</p>}
                            </div>
                          )}

                          {/* Hotel */}
                          {hotel && (
                            <div>
                              <div className="text-[9px] tracking-widest text-white/20 uppercase mb-1.5">Hotel Stay{hotel.nights ? ` · ${hotel.nights} night${hotel.nights > 1 ? "s" : ""}` : ""}</div>
                              <BookingRow
                                left={<>
                                  <span className="text-[13px] text-white/80">{hotel.name}</span>
                                </>}
                                price={hotel.price}
                                priceNote={hotel.total ? `${hotel.total} total` : undefined}
                                url={hotel.url}
                                highlight
                              />
                              {hotel.distance && <p className="text-[10px] text-white/20 mt-1 pl-1">{hotel.distance}</p>}
                            </div>
                          )}

                          {/* Return */}
                          {backFlight && (
                            <div>
                              <div className="text-[9px] tracking-widest text-white/20 uppercase mb-1.5">Return Flight{backFlight.date ? ` · ${backFlight.date}` : ""}</div>
                              <BookingRow
                                left={<>
                                  <span className="font-mono text-[11px] text-white/40 w-12">{backFlight.flight_code}</span>
                                  <span className="text-[13px] text-white/80">{backFlight.depart} → {backFlight.arrive}</span>
                                  <span className="text-[11px] text-white/30">{backFlight.route}</span>
                                  <span className="text-[11px] text-white/25">{backFlight.airline}</span>
                                </>}
                                price={backFlight.price}
                                url={backFlight.url}
                                highlight
                              />
                              {trip.flights_back_note && <p className="text-[10px] text-white/20 mt-1 pl-1">{trip.flights_back_note}</p>}
                            </div>
                          )}

                          {/* Ground */}
                          {trip.transport && (
                            <div className="pl-1 text-[10px] text-white/20">
                              <span className="text-white/15 uppercase tracking-widest text-[8px] mr-2">Ground</span>
                              {trip.transport}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Day-by-day itinerary */}
              {calendarItinerary.daily_schedule && calendarItinerary.daily_schedule.length > 0 && (
                <div className="mt-6 border-t border-white/5 pt-5">
                  <h4 className="text-[10px] tracking-widest text-white/25 uppercase mb-4">Day-by-Day Itinerary</h4>
                  <div className="flex flex-col gap-4">
                    {calendarItinerary.daily_schedule.map((day, di) => (
                      <div key={di}>
                        <div className="text-[11px] font-medium text-white/50 mb-1.5">{day.date}</div>
                        <div className="flex flex-col gap-0.5 pl-3 border-l border-white/8">
                          {day.items.map((item, ii) => (
                            <div key={ii} className="flex items-start gap-2 py-0.5">
                              <span className="text-[11px] text-white/25 shrink-0 w-16 tabular-nums">{item.time}</span>
                              <span className={`text-[9px] shrink-0 w-10 uppercase tracking-wider ${
                                item.type === "flight" ? "text-blue-300/40" :
                                item.type === "meeting" ? "text-white/30" :
                                item.type === "travel" ? "text-amber-200/30" :
                                item.type === "hotel" ? "text-white/20" :
                                "text-white/15"
                              }`}>
                                {item.type === "flight" ? "fly" :
                                 item.type === "meeting" ? "mtg" :
                                 item.type === "travel" ? "drive" :
                                 item.type === "hotel" ? "hotel" :
                                 ""}
                              </span>
                              <div className="min-w-0">
                                <span className="text-[11px] text-white/50">{item.event}</span>
                                {item.detail && <span className="text-[10px] text-white/20 ml-1.5">{item.detail}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Virtual meetings */}
              {calendarItinerary.no_travel_needed && calendarItinerary.no_travel_needed.length > 0 && (
                <div className="mt-4 pl-1">
                  <div className="text-[9px] tracking-widest text-white/15 uppercase mb-1">No travel needed</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {calendarItinerary.no_travel_needed.map((e, i) => (
                      <span key={i} className="text-[10px] text-white/15">{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fallback */}
          {fallback && !itinerary && (
            <div className="rounded-xl border border-white/8 bg-white/[0.04] p-5 backdrop-blur-xl">
              <Markdown content={fallback} />
            </div>
          )}

          {/* ═══ Itinerary ═══ */}
          {itinerary && (() => {
            const outFlight = recFlight(itinerary.flights_out || []);
            const backFlight = recFlight(itinerary.flights_back || []);
            const hotel = recHotel(itinerary.hotels || []);
            const outAlts = altFlights(itinerary.flights_out || []);
            const backAlts = altFlights(itinerary.flights_back || []);
            const hotelAlts = altHotels(itinerary.hotels || []);

            return (
              <div className="flex flex-col gap-0">
                {/* Trip header */}
                <div className="mb-5">
                  <h3 className="text-lg font-medium text-white">{itinerary.summary}</h3>
                  <span className="text-[12px] text-[#a3b18a]/70">{itinerary.total_estimate} estimated</span>
                </div>

                {/* ── Depart ── */}
                {outFlight && (
                  <div className="mb-1">
                    <div className="text-[10px] tracking-widest text-white/25 uppercase mb-2">Departing Flight{outFlight.date ? ` · ${outFlight.date}` : ""}</div>
                    <BookingRow
                      left={<>
                        <span className="font-mono text-[11px] text-white/40 w-12">{outFlight.flight_code}</span>
                        <span className="text-[13px] text-white/80">{outFlight.depart} → {outFlight.arrive}</span>
                        <span className="text-[11px] text-white/30">{outFlight.route}</span>
                        <span className="text-[11px] text-white/25">{outFlight.airline}</span>
                      </>}
                      price={outFlight.price}
                      url={outFlight.url}
                      highlight
                    />
                    {itinerary.flights_out_note && (
                      <p className="text-[11px] text-white/25 mt-1.5 mb-1 pl-1 leading-relaxed">{itinerary.flights_out_note}</p>
                    )}
                    <AltToggle count={outAlts.length} open={showAltFlightsOut} onToggle={() => setShowAltFlightsOut(!showAltFlightsOut)} />
                    {showAltFlightsOut && outAlts.map((f, i) => (
                      <div key={i} className="mt-1.5">
                        <BookingRow
                          left={<>
                            <span className="font-mono text-[11px] text-white/30 w-12">{f.flight_code}</span>
                            <span className="text-[13px] text-white/60">{f.depart} → {f.arrive}</span>
                            <span className="text-[11px] text-white/20">{f.route}</span>
                            <span className="text-[11px] text-white/15">{f.airline}</span>
                            {f.date && <span className="text-[11px] text-white/15">{f.date}</span>}
                          </>}
                          price={f.price}
                          url={f.url}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Stay ── */}
                {hotel && (
                  <div className="my-4">
                    <div className="text-[10px] tracking-widest text-white/25 uppercase mb-2">Hotel Stay{hotel.nights ? ` · ${hotel.nights} night${hotel.nights > 1 ? "s" : ""}` : ""}</div>
                    <BookingRow
                      left={<>
                        <span className="text-[13px] text-white/80">{hotel.name}</span>
                      </>}
                      price={hotel.price}
                      priceNote={hotel.total ? `${hotel.total} total` : undefined}
                      url={hotel.url}
                      highlight
                    />
                    {hotel.distance && (
                      <p className="text-[11px] text-white/25 mt-1.5 pl-1 leading-relaxed">{hotel.distance}</p>
                    )}
                    <AltToggle count={hotelAlts.length} open={showAltHotels} onToggle={() => setShowAltHotels(!showAltHotels)} />
                    {showAltHotels && hotelAlts.map((h, i) => (
                      <div key={i} className="mt-1.5">
                        <BookingRow
                          left={<>
                            <span className="text-[13px] text-white/60">{h.name}</span>
                            <span className="text-[11px] text-white/20">{h.distance}</span>
                          </>}
                          price={h.price}
                          priceNote={h.total ? `${h.total} total` : undefined}
                          url={h.url}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Return ── */}
                {backFlight && (
                  <div className="mb-1">
                    <div className="text-[10px] tracking-widest text-white/25 uppercase mb-2">Return Flight{backFlight.date ? ` · ${backFlight.date}` : ""}</div>
                    <BookingRow
                      left={<>
                        <span className="font-mono text-[11px] text-white/40 w-12">{backFlight.flight_code}</span>
                        <span className="text-[13px] text-white/80">{backFlight.depart} → {backFlight.arrive}</span>
                        <span className="text-[11px] text-white/30">{backFlight.route}</span>
                        <span className="text-[11px] text-white/25">{backFlight.airline}</span>
                      </>}
                      price={backFlight.price}
                      url={backFlight.url}
                      highlight
                    />
                    {itinerary.flights_back_note && (
                      <p className="text-[11px] text-white/25 mt-1.5 mb-1 pl-1 leading-relaxed">{itinerary.flights_back_note}</p>
                    )}
                    <AltToggle count={backAlts.length} open={showAltFlightsBack} onToggle={() => setShowAltFlightsBack(!showAltFlightsBack)} />
                    {showAltFlightsBack && backAlts.map((f, i) => (
                      <div key={i} className="mt-1.5">
                        <BookingRow
                          left={<>
                            <span className="font-mono text-[11px] text-white/30 w-12">{f.flight_code}</span>
                            <span className="text-[13px] text-white/60">{f.depart} → {f.arrive}</span>
                            <span className="text-[11px] text-white/20">{f.route}</span>
                            <span className="text-[11px] text-white/15">{f.airline}</span>
                            {f.date && <span className="text-[11px] text-white/15">{f.date}</span>}
                          </>}
                          price={f.price}
                          url={f.url}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Ground */}
                {itinerary.transport && (
                  <div className="mt-4 pl-1 text-[11px] text-white/25">
                    <span className="text-white/15 uppercase tracking-widest text-[9px] mr-2">Ground</span>
                    {itinerary.transport}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Saved trips */}
          {savedTrips.length > 0 && (
            <div className="mt-12 border-t border-white/5 pt-6">
              <h4 className="mb-3 text-[9px] tracking-widest text-white/20 uppercase">Past Trips</h4>
              <div className="flex flex-col gap-1">
                {savedTrips.map((trip) => (
                  <div key={trip.id} className="rounded-lg transition-all hover:bg-white/[0.02]">
                    <button
                      onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-left"
                    >
                      <span className="text-[12px] text-white/50 truncate min-w-0">{trip.itinerary?.summary || trip.request}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] text-white/15">{new Date(trip.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        {trip.itinerary?.total_estimate && <span className="text-[11px] text-[#a3b18a]/40">{trip.itinerary.total_estimate}</span>}
                        <button onClick={(e) => { e.stopPropagation(); setItinerary(trip.itinerary); setLastRequest(trip.request); setExpandedTrip(null); }}
                          title="Load"
                          className="p-0.5 text-white/10 hover:text-white/50 transition-colors">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                          </svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteTrip(trip.id); }}
                          title="Delete"
                          className="p-0.5 text-white/10 hover:text-red-400/60 transition-colors">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <svg className={`h-3 w-3 text-white/15 transition-transform ${expandedTrip === trip.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>
                    {expandedTrip === trip.id && trip.itinerary && (
                      <div className="px-3 pb-3 flex flex-col gap-1">
                        <p className="text-[11px] text-white/20 mb-1">{trip.itinerary.timeline}</p>
                        {(trip.itinerary.flights_out || []).filter((f) => f.recommended).map((f, i) => (
                          <div key={`o${i}`} className="text-[11px] text-white/35 flex gap-2">
                            <span className="font-mono text-white/25">{f.flight_code}</span>
                            <span>{f.depart}→{f.arrive}</span>
                            <span className="text-white/15">{f.route}</span>
                            <span className="text-[#a3b18a]/40 ml-auto">{f.price}</span>
                          </div>
                        ))}
                        {(trip.itinerary.hotels || []).filter((h) => h.recommended).map((h, i) => (
                          <div key={`h${i}`} className="text-[11px] text-white/35 flex gap-2">
                            <span>{h.name}</span>
                            <span className="text-[#a3b18a]/40 ml-auto">{h.price}</span>
                          </div>
                        ))}
                        {(trip.itinerary.flights_back || []).filter((f) => f.recommended).map((f, i) => (
                          <div key={`r${i}`} className="text-[11px] text-white/35 flex gap-2">
                            <span className="font-mono text-white/25">{f.flight_code}</span>
                            <span>{f.depart}→{f.arrive}</span>
                            <span className="text-white/15">{f.route}</span>
                            <span className="text-[#a3b18a]/40 ml-auto">{f.price}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared booking row ── */
function BookingRow({ left, price, priceNote, url, highlight }: {
  left: React.ReactNode;
  price: string;
  priceNote?: string;
  url: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
      highlight ? "border-white/8 bg-white/[0.04]" : "border-white/5 bg-white/[0.02]"
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        {left}
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <div className="text-right">
          <span className="text-[13px] font-medium text-[#a3b18a]">{price}</span>
          {priceNote && <span className="block text-[10px] text-white/20">{priceNote}</span>}
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="rounded-md border border-white/12 bg-white/[0.05] px-3 py-1 text-[9px] tracking-widest text-white/60 uppercase hover:bg-white/10 hover:border-white/20 transition-all">
          Book
        </a>
      </div>
    </div>
  );
}

function AltToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  if (count === 0) return null;
  return (
    <button onClick={onToggle} className="mt-1.5 pl-1 text-[9px] tracking-widest text-white/20 uppercase hover:text-white/35 transition-colors flex items-center gap-1">
      <svg className={`h-2 w-2 transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
      </svg>
      {count} other option{count > 1 ? "s" : ""}
    </button>
  );
}
