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

interface TravelPlan {
  id: string;
  request: string;
  result: string;
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
  const [result, setResult] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState("");
  const [refinement, setRefinement] = useState("");
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);

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

    fetch("/api/ai/travel-plan")
      .then((r) => r.json())
      .then((data) => {
        setPlans(data.plans || []);
        setLoadingPlans(false);
      })
      .catch(() => setLoadingPlans(false));
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

  const generatePlan = async (refineText?: string) => {
    const isRefine = !!refineText;
    const fullRequest = isRefine
      ? `Original request: ${lastRequest}\n\nPrevious result:\n${result}\n\nUpdate with this feedback: ${refineText}`
      : request.trim();
    if (!fullRequest) return;
    setGenerating(true);
    if (!isRefine) setResult(null);
    try {
      const res = await fetch("/api/ai/travel-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: fullRequest }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult(data.result);
        if (!isRefine) {
          setLastRequest(request.trim());
          setPlans((prev) => [{ id: data.id, request: request.trim(), result: data.result, createdAt: new Date().toISOString() }, ...prev]);
          setRequest("");
        } else {
          setRefinement("");
          // Update the most recent plan
          if (plans.length > 0) {
            setPlans((prev) => [{ ...prev[0], result: data.result }, ...prev.slice(1)]);
          }
        }
      }
    } catch {
      setResult("Failed to generate travel plan. Please try again.");
    }
    setGenerating(false);
  };

  const prefFields: { key: keyof TravelPreferences; label: string; placeholder: string }[] = [
    { key: "preferredAirlines", label: "Preferred Airlines", placeholder: "e.g. United, Delta, JetBlue" },
    { key: "preferredAirports", label: "Home Airports", placeholder: "e.g. SFO, OAK, SJC" },
    { key: "preferredHotels", label: "Preferred Hotels", placeholder: "e.g. Marriott, Hilton, boutique hotels" },
    { key: "seatPreference", label: "Seat Preference", placeholder: "e.g. Aisle, window, exit row" },
    { key: "timePreference", label: "Time Preferences", placeholder: "e.g. Morning flights, no red-eyes, arrive day before" },
    { key: "loyaltyPrograms", label: "Loyalty Programs", placeholder: "e.g. United MileagePlus Gold, Marriott Bonvoy Platinum" },
    { key: "otherNotes", label: "Other Notes", placeholder: "e.g. Need rental car, prefer direct flights, budget limit" },
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
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="180" ry="70" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(60 200 200)" />
          <ellipse cx="200" cy="200" rx="70" ry="180" fill="none" stroke="white" strokeWidth="0.4" transform="rotate(120 200 200)" />
        </svg>
      </div>

      <div className="relative z-10">
        <NavHeader />

        <div className="px-8 py-10 max-w-4xl mx-auto">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-3xl text-white" style={{ fontFamily: "var(--font-playfair), Georgia, serif" }}>
                Travel Planner
              </h2>
              <p className="mt-2 text-sm text-white/50">Describe your trip and get optimized travel options based on your preferences.</p>
            </div>
            <button
              onClick={() => setShowPrefs(!showPrefs)}
              className="rounded-lg border border-white/20 bg-white/[0.07] px-4 py-2 text-xs tracking-widest text-white/80 uppercase backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/10"
            >
              {showPrefs ? "Hide" : "Preferences"}
            </button>
          </div>

          {/* Preferences panel */}
          {showPrefs && (
            <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                Your Travel Preferences
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {prefFields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1.5 block text-[10px] tracking-widest text-white/60 uppercase">{field.label}</label>
                    <input
                      type="text"
                      value={prefs[field.key]}
                      onChange={(e) => setPrefs((p) => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={savePreferences}
                  disabled={savingPrefs}
                  className="rounded-lg border border-white/30 bg-white/20 px-5 py-2.5 text-xs tracking-widest text-white/80 uppercase transition-all hover:bg-white/25 disabled:opacity-50"
                >
                  {savingPrefs ? "Saving..." : savedPrefs ? "Update Preferences" : "Save Preferences"}
                </button>
              </div>
            </div>
          )}

          {/* Request input */}
          <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
            <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
              Plan a Trip
            </h3>
            <textarea
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="Describe your trip in natural language... e.g. 'I need to fly to LA for the Anduril meeting next Tuesday, coming back Thursday evening. Meeting is in Irvine.'"
              rows={4}
              className="w-full rounded-lg border border-white/10 bg-white/[0.07] px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 resize-none leading-relaxed"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => generatePlan()}
                disabled={generating || !request.trim()}
                className="rounded-lg border border-white/30 bg-white/20 px-5 py-2.5 text-xs tracking-widest text-white/80 uppercase transition-all hover:bg-white/25 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Options"}
              </button>
            </div>
          </div>

          {/* Current result */}
          {result && (
            <div className="mb-8 rounded-lg border border-white/10 bg-white/[0.07] p-6 backdrop-blur-xl">
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                Travel Options
              </h3>
              <Markdown content={result} />

              {/* Refine */}
              <div className="mt-6 border-t border-white/10 pt-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={refinement}
                    onChange={(e) => setRefinement(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && refinement.trim() && !generating) generatePlan(refinement.trim()); }}
                    placeholder="Refine: e.g. 'earlier flights' or 'cheaper hotels' or 'add a rental car'..."
                    className="flex-1 rounded-lg border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20"
                  />
                  <button
                    onClick={() => generatePlan(refinement.trim())}
                    disabled={generating || !refinement.trim()}
                    className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-xs tracking-widest text-white/70 uppercase transition-all hover:bg-white/15 disabled:opacity-40"
                  >
                    {generating ? "Updating..." : "Refine"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Past plans */}
          {!loadingPlans && plans.length > 0 && (
            <div>
              <h3 className="mb-4 text-[11px] font-medium tracking-widest text-white/50 uppercase">
                Past Plans
              </h3>
              <div className="flex flex-col gap-3">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-lg border border-white/10 bg-white/[0.07] p-4 backdrop-blur-xl transition-all hover:border-white/20"
                  >
                    <div
                      className="cursor-pointer flex items-start justify-between"
                      onClick={() => setExpandedPlan(expandedPlan === plan.id ? null : plan.id)}
                    >
                      <div>
                        <p className="text-sm text-white/80">{plan.request}</p>
                        <p className="mt-1 text-[10px] text-white/30">
                          {new Date(plan.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <svg className={`h-4 w-4 text-white/25 transition-transform shrink-0 ml-4 ${expandedPlan === plan.id ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                    {expandedPlan === plan.id && (
                      <div className="mt-4 border-t border-white/10 pt-4">
                        <Markdown content={plan.result} />
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
