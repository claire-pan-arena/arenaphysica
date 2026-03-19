const STATE_MAP: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "Washington, DC",
};

const CITY_ALIASES: [RegExp, string][] = [
  [/\blos\s*angeles\b/i, "Los Angeles, California"],
  [/\blax\b/i, "Los Angeles, California"],
  [/\bsan\s*francisco\b/i, "San Francisco, California"],
  [/\bsfo\b/i, "San Francisco, California"],
  [/\bnew\s*york\b/i, "New York, New York"],
  [/\bnyc\b/i, "New York, New York"],
  [/\bjfk\b/i, "New York, New York"],
  [/\birvine\b/i, "Irvine, California"],
  [/\bcosta\s*mesa\b/i, "Costa Mesa, California"],
  [/\banduril\b/i, "Costa Mesa, California"],
  [/\bhalf\s*moon\s*bay\b/i, "Half Moon Bay, California"],
  [/\bchicago\b/i, "Chicago, Illinois"],
  [/\bseattle\b/i, "Seattle, Washington"],
  [/\baustin\b/i, "Austin, Texas"],
  [/\bboston\b/i, "Boston, Massachusetts"],
  [/\bwashington\b/i, "Washington, DC"],
  [/\bmiami\b/i, "Miami, Florida"],
  [/\bdenver\b/i, "Denver, Colorado"],
  [/\batlanta\b/i, "Atlanta, Georgia"],
  [/\bdallas\b/i, "Dallas, Texas"],
  [/\bhouston\b/i, "Houston, Texas"],
  [/\bphoenix\b/i, "Phoenix, Arizona"],
  [/\bportland\b/i, "Portland, Oregon"],
  [/\bsan\s*diego\b/i, "San Diego, California"],
  [/\bsan\s*jose\b/i, "San Jose, California"],
  [/\bdetroit\b/i, "Detroit, Michigan"],
  [/\bhuntington\s*beach\b/i, "Huntington Beach, California"],
  [/\bnewport\s*beach\b/i, "Newport Beach, California"],
  [/\borange\s*county\b/i, "Orange County, California"],
  [/\bkimpton\s*sharebreak\b/i, "Huntington Beach, California"],
];

const OFFICE_PATTERNS = [
  /arena\s*(hq|physica|ai)/i,
  /\bwest\s*wing\b/i, /\beast\s*wing\b/i,
  /\btetris\b/i, /\bconf(erence)?\s*room\b/i, /\bmeeting\s*room\b/i,
  /\broom\s*\d/i, /\bfloor\s*\d/i, /\b\d+\w*\s*floor\b/i, /\blobby\b/i, /\bkitchen\b/i, /\bcafeteria\b/i,
];

const VENUE_PATTERNS = [
  /\bhotel\b/i, /\bresort\b/i, /\binn\b/i, /\bsuites?\b/i, /\blodge\b/i, /\bhostel\b/i,
  /\bkimpton\b/i, /\bhilton\b/i, /\bmarriott\b/i, /\bhyatt\b/i, /\bsheraton\b/i,
  /\bwestin\b/i, /\bfairmont\b/i, /\britz/i, /\bfour\s*seasons\b/i, /\bw\s+hotel\b/i,
  /\brestaurant\b/i, /\bcafe\b/i, /\bbar\b/i, /\bgrill\b/i, /\bbistro\b/i,
  /\bstadium\b/i, /\barena\b(?!\s*(ai|physica))/i, /\bcenter\b/i, /\bcentre\b/i,
];

const VIRTUAL_PATTERNS = [
  /^https?:\/\//, /zoom\.us/i, /meet\.google/i, /teams\.microsoft/i, /whereby\.com/i,
];

const SOCIAL_PATTERNS = [
  /happy\s*hour/i, /team\s*lunch/i, /team\s*dinner/i, /team\s*outing/i,
  /birthday/i, /celebration/i, /party/i, /drinks/i, /karaoke/i, /bowling/i, /game\s*night/i,
];

function extractCityFromAddress(location: string): string | null {
  const parts = location.split(",").map((s) => s.trim());
  if (parts.length < 2) return null;

  // Strip trailing country
  if (/^(usa|us|united\s*states)$/i.test(parts[parts.length - 1])) {
    parts.pop();
  }
  if (parts.length < 2) return null;

  // Walk backwards to find a state abbreviation, then grab the city before it
  for (let i = parts.length - 1; i >= 1; i--) {
    const cleaned = parts[i].replace(/\d{5}(-\d{4})?/g, "").trim();
    const fullState = STATE_MAP[cleaned.toUpperCase()];
    if (!fullState) continue;

    for (let j = i - 1; j >= 0; j--) {
      const candidate = parts[j].trim();
      if (/^\d/.test(candidate) || candidate.length <= 2) continue;
      return `${candidate}, ${fullState}`;
    }
  }

  // Fallback: if first part is a venue/address, use the remaining parts as city
  if (parts.length >= 2) {
    const first = parts[0];
    const isVenue = VENUE_PATTERNS.some((p) => p.test(first));
    const isAddress = /^\d/.test(first);

    if (isVenue || isAddress) {
      // Try remaining parts as "City, State"
      const rest = parts.slice(1);
      if (rest.length >= 2) {
        const maybeState = rest[rest.length - 1].replace(/\d{5}(-\d{4})?/g, "").trim();
        const fullState = STATE_MAP[maybeState.toUpperCase()];
        if (fullState) {
          return `${rest[rest.length - 2].trim()}, ${fullState}`;
        }
      }
      // If just one part left, check aliases on it
      if (rest.length === 1) {
        for (const [pattern, city] of CITY_ALIASES) {
          if (pattern.test(rest[0])) return city;
        }
      }
    }

    if (parts.length === 2 && !isVenue) {
      return `${parts[0]}, ${parts[1]}`;
    }
  }

  return null;
}

/** Returns true if this location is an office room or virtual meeting */
export function isOfficeOrVirtual(location: string, summary: string): boolean {
  if (VIRTUAL_PATTERNS.some((p) => p.test(location))) return true;
  if (OFFICE_PATTERNS.some((p) => p.test(location) || p.test(summary))) return true;
  return false;
}

/** Returns true if the event title suggests a social/internal event */
export function isSocialEvent(summary: string): boolean {
  return SOCIAL_PATTERNS.some((p) => p.test(summary));
}

/**
 * Normalize a raw location string to "City, State" or "City, Country".
 * Returns null if location can't be resolved to a city.
 */
/**
 * Check if an event summary indicates travel, e.g. "Claire in LA", "Team offsite in Austin".
 * Returns the city if found, null otherwise.
 */
export function extractCityFromSummary(summary: string): string | null {
  const match = summary.match(/\bin\s+(.+)/i);
  if (!match) return null;
  const tail = match[1].trim();
  for (const [pattern, city] of CITY_ALIASES) {
    if (pattern.test(tail)) return city;
  }
  return null;
}

export function normalizeToCity(location: string): string | null {
  // Check known city aliases with word-boundary matching
  for (const [pattern, city] of CITY_ALIASES) {
    if (pattern.test(location)) return city;
  }

  // Try to extract city from address
  const city = extractCityFromAddress(location);
  if (!city) return null;

  // Reject if the extracted "city" is still a venue name, not a real city
  const cityPart = city.split(",")[0].trim();
  if (VENUE_PATTERNS.some((p) => p.test(cityPart))) return null;

  return city;
}
