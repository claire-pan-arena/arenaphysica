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

interface SavedTrip {
  id: string;
  request: string;
  itinerary: Itinerary | null;
  createdAt: string;
}

const EMPTY_PREFS: TravelPreferences = {
  preferredAirlines: "",
  preferredAirports: "",
  preferredHotels: "",
  seatPreference: "",
  timePreference: "",
  loyaltyPrograms: "",
  otherNotes: "",
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

  useEffect(() => {
    fetch("/api/travel-preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) { setPrefs(data.preferences); setSavedPrefs(true); }
        else setShowPrefs(true);
      })
      .catch(() => {});

    fetch("/api/ai/travel-plan")
      .then((r) => r.json())
      .then((data) => setSavedTrips(data.plans || []))
      .catch(() => {});
  }, []);

  const savePreferences = async () => {
    setSavingPrefs(true);
    await fetch("/api/travel-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prefs),
    });
    setSavingPrefs(false);
    setSavedPrefs(true);
    setShowPrefs(false);
  };

  const generate = async (refineText?: string) => {
    const isRefine = !!refineText;
    if (!isRefine && !request.trim()) return;
    setGenerating(true);
    if (!isRefine) { setItinerary(null); setFallback(null); }
    try {
      const res = await fetch("/api/ai/travel-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: isRefine ? lastRequest : request.trim(),
          refine: refineText || undefined,
          previousResult: isRefine && itinerary ? JSON.stringify(itinerary) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setFallback(`Error: ${data.error}`);
      } else if (data.itinerary) {
        setItinerary(data.itinerary);
        setFallback(null);
        if (!isRefine) {
          setSavedTrips((prev) => [{ id: data.id, request: request.trim(), itinerary: data.itinerary, createdAt: new Date().toISOString() }, ...prev]);
        } else if (savedTrips.length > 0) {
          setSavedTrips((prev) => [{ ...prev[0], itinerary: data.itinerary }, ...prev.slice(1)]);
        }
      } else if (data.fallback) {
        setFallback(data.fallback);
      }
      if (!isRefine) {
        setLastRequest(request.trim());
        setRequest("");
      }
      setRefinement("");
    } catch {
      setFallback("Something went wrong. Please try again.");
    }
    setGenerating(false);
  };

  const prefFields: { key: keyof TravelPreferences; label: string; placeholder: string }[] = [
    { key: "preferredAirlines", label: "Airlines", placeholder: "e.g. United, Delta" },
    { key: "preferredAirports", label: "Home Airports", placeholder: "e.g. SFO, JFK" },
    { key: "preferredHotels", label: "Hotels", placeholder: "e.g. Marriott, Hilton" },
    { key: "seatPreference", label: "Seat", placeholder: "e.g. Aisle" },
    { key: "timePreference", label: "Times", placeholder: "e.g. Morning flights" },
    { key: "loyaltyPrograms", label: "Loyalty", placeholder: "e.g. United Gold" },
    { key: "otherNotes", label: "Notes", placeholder: "e.g. No red-eyes" },
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

        <div className="px-8 py-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl text-white" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
              Travel Planner
            </h2>
            <button
              onClick={() => setShowPrefs(!showPrefs)}
              className="text-[10px] tracking-widest text-white/40 uppercase hover:text-white/60 transition-colors"
            >
              {showPrefs ? "Close" : "Preferences"}
            </button>
          </div>

          {/* Preferences */}
          {showPrefs && (
            <div className="mb-5 rounded-lg border border-white/10 bg-white/[0.06] p-4 backdrop-blur-xl">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {prefFields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-0.5 block text-[9px] tracking-widest text-white/30 uppercase">{f.label}</label>
                    <input
                      type="text"
                      value={prefs[f.key]}
                      onChange={(e) => setPrefs((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-white/20"
                    />
                  </div>
                ))}
              </div>
              <button onClick={savePreferences} disabled={savingPrefs} className="mt-2.5 text-[10px] tracking-widest text-white/50 uppercase hover:text-white/70 disabled:opacity-40">
                {savingPrefs ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {/* Search + Refine */}
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
              placeholder={itinerary ? "Refine: 'earlier flight', 'cheaper hotel', 'add rental car'..." : "Where do you need to be? e.g. 'Anduril in Irvine Tuesday 2pm, back Wed'"}
              autoFocus
              className="flex-1 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-white/20 backdrop-blur-xl"
            />
            {itinerary ? (
              <>
                <button
                  onClick={() => generate(refinement.trim())}
                  disabled={generating || !refinement.trim()}
                  className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-[10px] tracking-widest text-white/70 uppercase transition-all hover:bg-white/15 disabled:opacity-30"
                >
                  {generating ? "..." : "Refine"}
                </button>
                <button
                  onClick={() => { setItinerary(null); setFallback(null); setRefinement(""); }}
                  className="shrink-0 rounded-lg border border-white/10 px-3 py-2.5 text-[10px] tracking-widest text-white/30 uppercase hover:text-white/50 transition-colors"
                >
                  New
                </button>
              </>
            ) : (
              <button
                onClick={() => generate()}
                disabled={generating || !request.trim()}
                className="shrink-0 rounded-lg border border-white/25 bg-white/10 px-5 py-2.5 text-[10px] tracking-widest text-white/70 uppercase transition-all hover:bg-white/15 disabled:opacity-30"
              >
                {generating ? "Searching..." : "Go"}
              </button>
            )}
          </div>

          {/* Loading */}
          {generating && !itinerary && (
            <div className="flex items-center justify-center gap-3 py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-white/50" />
              <span className="text-xs text-white/40">Searching flights and hotels...</span>
            </div>
          )}

          {/* Fallback */}
          {fallback && !itinerary && (
            <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5 backdrop-blur-xl">
              <Markdown content={fallback} />
            </div>
          )}

          {/* Itinerary */}
          {itinerary && (
            <div className="flex flex-col gap-5">
              {/* Summary */}
              <div className="rounded-lg border border-white/10 bg-white/[0.06] px-5 py-4 backdrop-blur-xl">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold text-white">{itinerary.summary}</h3>
                  <span className="text-base font-semibold text-emerald-300">{itinerary.total_estimate}</span>
                </div>
                <p className="mt-1.5 text-xs text-white/40 leading-relaxed">{itinerary.timeline}</p>
              </div>

              {/* Outbound */}
              <FlightSection label="Outbound" flights={itinerary.flights_out || []} note={itinerary.flights_out_note} />

              {/* Return */}
              <FlightSection label="Return" flights={itinerary.flights_back || []} note={itinerary.flights_back_note} />

              {/* Hotel */}
              <HotelSection hotels={itinerary.hotels || []} />

              {/* Ground */}
              {itinerary.transport && (
                <div className="flex items-baseline gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-3">
                  <span className="text-[9px] tracking-widest text-white/30 uppercase shrink-0">Ground</span>
                  <span className="text-xs text-white/50">{itinerary.transport}</span>
                </div>
              )}
            </div>
          )}

          {/* Saved trips */}
          {savedTrips.length > 0 && (
            <div className="mt-10">
              <h4 className="mb-3 text-[10px] font-medium tracking-widest text-white/30 uppercase">Saved Trips</h4>
              <div className="flex flex-col gap-2">
                {savedTrips.map((trip) => (
                  <div key={trip.id} className="rounded-lg border border-white/10 bg-white/[0.04] backdrop-blur-xl transition-all hover:border-white/15">
                    <button
                      onClick={() => setExpandedTrip(expandedTrip === trip.id ? null : trip.id)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="text-sm text-white/70">{trip.itinerary?.summary || trip.request}</span>
                        <span className="text-[10px] text-white/25">
                          {new Date(trip.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {trip.itinerary?.total_estimate && (
                          <span className="text-xs text-emerald-300/60">{trip.itinerary.total_estimate}</span>
                        )}
                        <svg className={`h-3.5 w-3.5 text-white/20 transition-transform ${expandedTrip === trip.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                        </svg>
                      </div>
                    </button>
                    {expandedTrip === trip.id && trip.itinerary && (
                      <div className="px-4 pb-4 flex flex-col gap-3 border-t border-white/5 pt-3">
                        <p className="text-xs text-white/35">{trip.itinerary.timeline}</p>
                        {(trip.itinerary.flights_out || []).map((f, i) => <FlightRow key={`o${i}`} flight={f} />)}
                        {(trip.itinerary.flights_back || []).map((f, i) => <FlightRow key={`r${i}`} flight={f} />)}
                        {(trip.itinerary.hotels || []).filter((h) => h.recommended).map((h, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-white/50">{h.name}</span>
                            <span className="text-emerald-300/60">{h.price}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => {
                              setItinerary(trip.itinerary);
                              setLastRequest(trip.request);
                              setExpandedTrip(null);
                            }}
                            className="text-[10px] tracking-widest text-white/30 uppercase hover:text-white/50 transition-colors"
                          >
                            Load
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              await fetch("/api/ai/travel-plan", {
                                method: "DELETE",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ id: trip.id }),
                              });
                              setSavedTrips((prev) => prev.filter((t) => t.id !== trip.id));
                            }}
                            className="text-[10px] tracking-widest text-white/20 uppercase hover:text-red-400/60 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
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

/* ── Flight Section ── */
function FlightSection({ label, flights, note }: { label: string; flights: Flight[]; note?: string }) {
  const [showAlts, setShowAlts] = useState(false);
  const recommended = flights.find((f) => f.recommended) || flights[0];
  const alternatives = flights.filter((f) => f !== recommended);
  if (!recommended) return null;

  return (
    <div>
      <h4 className="mb-2 text-[9px] tracking-widest text-white/30 uppercase">{label}</h4>
      <FlightCard flight={recommended} />
      {note && <p className="mt-2 px-1 text-[11px] text-white/30 leading-relaxed">{note}</p>}
      {alternatives.length > 0 && (
        <>
          <button
            onClick={() => setShowAlts(!showAlts)}
            className="mt-2 px-1 text-[10px] tracking-widest text-white/25 uppercase hover:text-white/40 transition-colors flex items-center gap-1"
          >
            <svg className={`h-2.5 w-2.5 transition-transform ${showAlts ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            {alternatives.length} other option{alternatives.length > 1 ? "s" : ""}
          </button>
          {showAlts && (
            <div className="mt-2 flex flex-col gap-1.5">
              {alternatives.map((f, i) => <FlightCard key={i} flight={f} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FlightCard({ flight }: { flight: Flight }) {
  return (
    <div className={`grid grid-cols-[1fr_auto] items-center rounded-lg border px-5 py-3 ${
      flight.recommended ? "border-emerald-400/15 bg-emerald-400/[0.04]" : "border-white/8 bg-white/[0.03]"
    }`}>
      <div className="flex items-center gap-6">
        <div className="w-20">
          <div className="text-[13px] font-medium text-white/90">{flight.airline}</div>
          <div className="text-[10px] text-white/30 font-mono">{flight.flight_code}</div>
        </div>
        <div className="text-[11px] text-white/35">{flight.route}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] text-white/80">{flight.depart} → {flight.arrive}</span>
          {flight.date && <span className="text-[11px] text-white/30">{flight.date}</span>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[13px] font-semibold text-emerald-300">{flight.price}</span>
        <a
          href={flight.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-white/15 bg-white/[0.07] px-3.5 py-1 text-[10px] tracking-widest text-white/70 uppercase transition-all hover:bg-white/15 hover:border-white/25"
        >
          Book
        </a>
      </div>
    </div>
  );
}

function FlightRow({ flight }: { flight: Flight }) {
  if (!flight.recommended) return null;
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 text-white/50">
        <span>{flight.flight_code}</span>
        <span className="text-white/25">{flight.route}</span>
        <span>{flight.depart} → {flight.arrive}</span>
        {flight.date && <span className="text-white/25">{flight.date}</span>}
      </div>
      <span className="text-emerald-300/60">{flight.price}</span>
    </div>
  );
}

/* ── Hotel Section ── */
function HotelSection({ hotels }: { hotels: Hotel[] }) {
  const [showAlts, setShowAlts] = useState(false);
  const recommended = hotels.find((h) => h.recommended) || hotels[0];
  const alternatives = hotels.filter((h) => h !== recommended);
  if (!recommended) return null;

  return (
    <div>
      <h4 className="mb-2 text-[9px] tracking-widest text-white/30 uppercase">Hotel</h4>
      <HotelCard hotel={recommended} />
      {alternatives.length > 0 && (
        <>
          <button
            onClick={() => setShowAlts(!showAlts)}
            className="mt-2 px-1 text-[10px] tracking-widest text-white/25 uppercase hover:text-white/40 transition-colors flex items-center gap-1"
          >
            <svg className={`h-2.5 w-2.5 transition-transform ${showAlts ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
            {alternatives.length} other option{alternatives.length > 1 ? "s" : ""}
          </button>
          {showAlts && (
            <div className="mt-2 flex flex-col gap-1.5">
              {alternatives.map((h, i) => <HotelCard key={i} hotel={h} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  return (
    <div className={`grid grid-cols-[1fr_auto] items-center rounded-lg border px-5 py-3 ${
      hotel.recommended ? "border-emerald-400/15 bg-emerald-400/[0.04]" : "border-white/8 bg-white/[0.03]"
    }`}>
      <div className="flex items-center gap-5">
        <span className="text-[13px] font-medium text-white/90">{hotel.name}</span>
        <span className="text-[11px] text-white/30">{hotel.distance}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <span className="text-[13px] font-semibold text-emerald-300">{hotel.price}</span>
          {hotel.total && <span className="ml-2 text-[11px] text-white/25">{hotel.total} total</span>}
        </div>
        <a
          href={hotel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-white/15 bg-white/[0.07] px-3.5 py-1 text-[10px] tracking-widest text-white/70 uppercase transition-all hover:bg-white/15 hover:border-white/25"
        >
          Book
        </a>
      </div>
    </div>
  );
}
