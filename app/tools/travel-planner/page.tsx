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

  useEffect(() => {
    fetch("/api/travel-preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) {
          setPrefs(data.preferences);
          setSavedPrefs(true);
        } else {
          setShowPrefs(true);
        }
      })
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

  const hasResult = itinerary || fallback;

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

        <div className="px-8 py-10 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl text-white" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
                Travel Planner
              </h2>
              <p className="mt-1 text-xs text-white/40">Tell us where you need to be. We handle the rest.</p>
            </div>
            <button
              onClick={() => setShowPrefs(!showPrefs)}
              className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-[10px] tracking-widest text-white/50 uppercase transition-all hover:border-white/25 hover:text-white/70"
            >
              {showPrefs ? "Close" : "Preferences"}
            </button>
          </div>

          {/* Preferences (collapsed by default) */}
          {showPrefs && (
            <div className="mb-6 rounded-lg border border-white/10 bg-white/[0.07] p-5 backdrop-blur-xl">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {prefFields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-[9px] tracking-widest text-white/40 uppercase">{f.label}</label>
                    <input
                      type="text"
                      value={prefs[f.key]}
                      onChange={(e) => setPrefs((p) => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-white placeholder-white/20 outline-none focus:border-white/20"
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={savePreferences}
                disabled={savingPrefs}
                className="mt-3 rounded border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] tracking-widest text-white/60 uppercase transition-all hover:bg-white/15 disabled:opacity-40"
              >
                {savingPrefs ? "Saving..." : "Save"}
              </button>
            </div>
          )}

          {/* Trip input */}
          {!hasResult && (
            <div className="rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
              <textarea
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && request.trim()) { e.preventDefault(); generate(); } }}
                placeholder="Where do you need to be? e.g. 'Anduril meeting in Irvine Tuesday 2pm, back Wednesday evening' or 'Customer visit in Detroit March 20-22, meetings at 9am each day'"
                rows={2}
                autoFocus
                className="w-full rounded-lg border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white placeholder-white/25 outline-none focus:border-white/20 resize-none leading-relaxed"
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => generate()}
                  disabled={generating || !request.trim()}
                  className="rounded-lg border border-white/30 bg-white/15 px-6 py-2.5 text-xs tracking-widest text-white/80 uppercase transition-all hover:bg-white/20 disabled:opacity-40"
                >
                  {generating ? "Searching..." : "Find Options"}
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {generating && !itinerary && (
            <div className="mt-8 flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
              <p className="text-xs text-white/40">Searching flights and hotels...</p>
            </div>
          )}

          {/* Fallback (raw text if JSON parse failed) */}
          {fallback && !itinerary && (
            <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
              <Markdown content={fallback} />
            </div>
          )}

          {/* Structured itinerary */}
          {itinerary && (
            <div className="mt-2 flex flex-col gap-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.07] px-5 py-3 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-white">{itinerary.summary}</h3>
                  <span className="text-xs text-white/40">{itinerary.timeline}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-300">{itinerary.total_estimate}</span>
              </div>

              {/* Outbound flights */}
              <FlightSection
                label="Outbound"
                flights={itinerary.flights_out || []}
                note={itinerary.flights_out_note}
              />

              {/* Return flights */}
              <FlightSection
                label="Return"
                flights={itinerary.flights_back || []}
                note={itinerary.flights_back_note}
              />

              {/* Hotels */}
              <HotelSection hotels={itinerary.hotels || []} />

              {/* Transport */}
              {itinerary.transport && (
                <div className="rounded-lg border border-white/10 bg-white/[0.05] px-5 py-3">
                  <span className="text-[10px] tracking-widest text-white/40 uppercase mr-3">Ground</span>
                  <span className="text-sm text-white/60">{itinerary.transport}</span>
                </div>
              )}

              {/* Refine bar */}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={refinement}
                  onChange={(e) => setRefinement(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && refinement.trim() && !generating) generate(refinement.trim()); }}
                  placeholder="Change something... e.g. 'earlier flight' or 'hotel closer to downtown'"
                  className="flex-1 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-white/20"
                />
                <button
                  onClick={() => generate(refinement.trim())}
                  disabled={generating || !refinement.trim()}
                  className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-[10px] tracking-widest text-white/60 uppercase transition-all hover:bg-white/15 disabled:opacity-30"
                >
                  {generating ? "..." : "Refine"}
                </button>
                <button
                  onClick={() => { setItinerary(null); setFallback(null); setRequest(lastRequest); }}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5 text-[10px] tracking-widest text-white/30 uppercase transition-all hover:text-white/50"
                >
                  New Trip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlightSection({ label, flights, note }: { label: string; flights: Flight[]; note?: string }) {
  const [showAlts, setShowAlts] = useState(false);
  const recommended = flights.find((f) => f.recommended) || flights[0];
  const alternatives = flights.filter((f) => f !== recommended);

  if (!recommended) return null;

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-medium tracking-widest text-white/40 uppercase">{label}</h4>
      <FlightCard flight={recommended} />
      {note && (
        <p className="mt-1.5 ml-1 text-xs text-white/35 leading-relaxed">{note}</p>
      )}
      {alternatives.length > 0 && (
        <button
          onClick={() => setShowAlts(!showAlts)}
          className="mt-2 ml-1 text-[10px] tracking-widest text-white/30 uppercase hover:text-white/50 transition-colors flex items-center gap-1.5"
        >
          <svg className={`h-3 w-3 transition-transform ${showAlts ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          {alternatives.length} other option{alternatives.length > 1 ? "s" : ""}
        </button>
      )}
      {showAlts && (
        <div className="mt-2 flex flex-col gap-2">
          {alternatives.map((f, i) => (
            <FlightCard key={i} flight={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FlightCard({ flight }: { flight: Flight }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border px-5 py-3 backdrop-blur-xl transition-all ${
      flight.recommended
        ? "border-emerald-400/20 bg-emerald-400/[0.06]"
        : "border-white/10 bg-white/[0.05]"
    }`}>
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white/90">{flight.airline}</span>
          <span className="text-[10px] text-white/35 font-mono">{flight.flight_code}{flight.date ? ` · ${flight.date}` : ""}</span>
        </div>
        <div className="text-xs text-white/40">{flight.route}</div>
        <div className="text-sm text-white/70">{flight.depart} → {flight.arrive}</div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm font-semibold text-emerald-300">{flight.price}</span>
        <a
          href={flight.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] tracking-widest text-white/80 uppercase transition-all hover:bg-white/20 hover:border-white/30"
        >
          Book
        </a>
      </div>
    </div>
  );
}

function HotelSection({ hotels }: { hotels: Hotel[] }) {
  const [showAlts, setShowAlts] = useState(false);
  const recommended = hotels.find((h) => h.recommended) || hotels[0];
  const alternatives = hotels.filter((h) => h !== recommended);

  if (!recommended) return null;

  return (
    <div>
      <h4 className="mb-2 text-[10px] font-medium tracking-widest text-white/40 uppercase">Hotel</h4>
      <HotelCard hotel={recommended} />
      {alternatives.length > 0 && (
        <button
          onClick={() => setShowAlts(!showAlts)}
          className="mt-2 ml-1 text-[10px] tracking-widest text-white/30 uppercase hover:text-white/50 transition-colors flex items-center gap-1.5"
        >
          <svg className={`h-3 w-3 transition-transform ${showAlts ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
          {alternatives.length} other option{alternatives.length > 1 ? "s" : ""}
        </button>
      )}
      {showAlts && (
        <div className="mt-2 flex flex-col gap-2">
          {alternatives.map((h, i) => (
            <HotelCard key={i} hotel={h} />
          ))}
        </div>
      )}
    </div>
  );
}

function HotelCard({ hotel }: { hotel: Hotel }) {
  return (
    <div className={`flex items-center justify-between rounded-lg border px-5 py-3 backdrop-blur-xl transition-all ${
      hotel.recommended
        ? "border-emerald-400/20 bg-emerald-400/[0.06]"
        : "border-white/10 bg-white/[0.05]"
    }`}>
      <div className="flex items-center gap-5">
        <div className="text-sm font-medium text-white/90">{hotel.name}</div>
        <div className="text-xs text-white/40">{hotel.distance}</div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <span className="text-sm font-semibold text-emerald-300">{hotel.price}</span>
          {hotel.total && <span className="ml-2 text-xs text-white/30">{hotel.total} total</span>}
        </div>
        <a
          href={hotel.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-white/20 bg-white/10 px-4 py-1.5 text-[10px] tracking-widest text-white/80 uppercase transition-all hover:bg-white/20 hover:border-white/30"
        >
          Book
        </a>
      </div>
    </div>
  );
}
