/**
 * lib/geo.ts
 * Lightweight location intelligence for job filtering and scoring.
 * Heuristic, dependency-free: detects which country a free-text job
 * location refers to, so we can drop/penalize roles the user could
 * never reasonably take (e.g. on-site in another country).
 */

const US_STATE_ABBREVS = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

const US_STATE_NAMES = [
  'alabama','alaska','arizona','arkansas','california','colorado','connecticut','delaware','florida',
  'georgia','hawaii','idaho','illinois','indiana','iowa','kansas','kentucky','louisiana','maine',
  'maryland','massachusetts','michigan','minnesota','mississippi','missouri','montana','nebraska',
  'nevada','new hampshire','new jersey','new mexico','new york','north carolina','north dakota','ohio',
  'oklahoma','oregon','pennsylvania','rhode island','south carolina','south dakota','tennessee','texas',
  'utah','vermont','virginia','washington','west virginia','wisconsin','wyoming',
];

// Canonical country name -> phrases that identify it in a location string.
// Only unambiguous identifiers — no city names that collide across countries.
const COUNTRY_MARKERS: Record<string, string[]> = {
  'United States': ['united states', 'usa', 'u.s.', 'u.s.a', 'us only', 'us-only', 'america'],
  'Canada': ['canada', 'ontario', 'quebec', 'british columbia', 'toronto', 'vancouver', 'montreal'],
  'United Kingdom': ['united kingdom', 'uk', 'england', 'scotland', 'wales', 'northern ireland', 'london, uk'],
  'Ireland': ['ireland', 'dublin'],
  'Germany': ['germany', 'deutschland', 'berlin', 'munich', 'münchen', 'hamburg', 'frankfurt'],
  'France': ['france', 'paris'],
  'Spain': ['spain', 'madrid', 'barcelona'],
  'Portugal': ['portugal', 'lisbon', 'lisboa', 'porto'],
  'Netherlands': ['netherlands', 'amsterdam', 'rotterdam'],
  'Belgium': ['belgium', 'brussels'],
  'Switzerland': ['switzerland', 'zurich', 'zürich', 'geneva'],
  'Austria': ['austria', 'vienna'],
  'Italy': ['italy', 'milan', 'rome'],
  'Poland': ['poland', 'warsaw', 'krakow', 'kraków', 'wroclaw', 'wrocław'],
  'Czech Republic': ['czech republic', 'czechia', 'prague'],
  'Romania': ['romania', 'bucharest'],
  'Hungary': ['hungary', 'budapest'],
  'Greece': ['greece', 'athens'],
  'Sweden': ['sweden', 'stockholm'],
  'Norway': ['norway', 'oslo'],
  'Denmark': ['denmark', 'copenhagen'],
  'Finland': ['finland', 'helsinki'],
  'Estonia': ['estonia', 'tallinn'],
  'Ukraine': ['ukraine', 'kyiv', 'kiev'],
  'Turkey': ['turkey', 'türkiye', 'istanbul', 'ankara'],
  'Israel': ['israel', 'tel aviv'],
  'United Arab Emirates': ['united arab emirates', 'uae', 'dubai', 'abu dhabi'],
  'Saudi Arabia': ['saudi arabia', 'riyadh'],
  'India': ['india', 'bangalore', 'bengaluru', 'mumbai', 'hyderabad', 'chennai', 'pune', 'new delhi', 'noida', 'gurgaon'],
  'Pakistan': ['pakistan', 'karachi', 'lahore', 'islamabad'],
  'Bangladesh': ['bangladesh', 'dhaka'],
  'Sri Lanka': ['sri lanka', 'colombo'],
  'China': ['china', 'beijing', 'shanghai', 'shenzhen'],
  'Hong Kong': ['hong kong'],
  'Taiwan': ['taiwan', 'taipei'],
  'Japan': ['japan', 'tokyo', 'osaka'],
  'South Korea': ['south korea', 'korea', 'seoul'],
  'Singapore': ['singapore'],
  'Malaysia': ['malaysia', 'kuala lumpur'],
  'Indonesia': ['indonesia', 'jakarta'],
  'Thailand': ['thailand', 'bangkok'],
  'Vietnam': ['vietnam', 'ho chi minh', 'hanoi'],
  'Philippines': ['philippines', 'manila', 'cebu'],
  'Australia': ['australia', 'sydney', 'melbourne', 'brisbane', 'perth'],
  'New Zealand': ['new zealand', 'auckland', 'wellington'],
  'Mexico': ['mexico', 'méxico', 'mexico city', 'guadalajara', 'monterrey'],
  'Costa Rica': ['costa rica', 'san josé, cr', 'guápiles'],
  'Panama': ['panama'],
  'Guatemala': ['guatemala'],
  'Colombia': ['colombia', 'bogotá', 'bogota', 'medellín', 'medellin'],
  'Brazil': ['brazil', 'brasil', 'são paulo', 'sao paulo', 'rio de janeiro'],
  'Argentina': ['argentina', 'buenos aires'],
  'Chile': ['chile', 'santiago'],
  'Peru': ['peru', 'lima'],
  'Uruguay': ['uruguay', 'montevideo'],
  'Egypt': ['egypt', 'cairo'],
  'Nigeria': ['nigeria', 'lagos'],
  'Kenya': ['kenya', 'nairobi'],
  'South Africa': ['south africa', 'cape town', 'johannesburg'],
  // Region-restricted hiring reads as "foreign" for anyone outside the region
  'Europe (region)': ['europe', 'emea', 'eu only', 'european union'],
  'Asia-Pacific (region)': ['apac', 'asia-pacific', 'southeast asia'],
  'Latin America (region)': ['latam', 'latin america', 'south america'],
};

/**
 * Best-effort country detection from a free-text job location.
 * Returns the canonical country name, or null when undeterminable
 * (e.g. "Remote", "Various", or a bare city we don't recognize).
 */
export function detectCountry(location: string | null | undefined): string | null {
  if (!location) return null;
  const loc = location.toLowerCase().trim();
  if (!loc) return null;
  // Only bail when the location is PURELY remote-ish ("Remote", "Anywhere") —
  // "Remote - EMEA" or "Canada - Remote" still carries geography to detect.
  const stripped = loc
    .replace(/\b(remote|anywhere|worldwide|global|various|flexible|hybrid|on-?site|only)\b/g, ' ')
    .replace(/[\s\-,./();]+/g, ' ')
    .trim();
  if (!stripped) return null;

  // Explicit country markers first (most reliable)
  for (const [country, markers] of Object.entries(COUNTRY_MARKERS)) {
    for (const marker of markers) {
      // Word-boundary match so "uk" doesn't hit inside another word
      const re = new RegExp(`(^|[\\s,(/])${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[\\s,)./])`);
      if (re.test(loc)) return country;
    }
  }

  // US state names
  for (const state of US_STATE_NAMES) {
    const re = new RegExp(`(^|[\\s,])${state}($|[\\s,)])`);
    if (re.test(loc)) return 'United States';
  }

  // US state abbreviations after a comma: "El Paso, TX" / "Eau Claire, WI 54701"
  const abbrevMatch = location.match(/,\s*([A-Z]{2})(?:\s+\d{5})?\s*(?:,\s*(?:US|USA|United States))?\s*$/);
  if (abbrevMatch && US_STATE_ABBREVS.includes(abbrevMatch[1])) return 'United States';

  return null;
}

/** Normalize stored country values ("US", "us", "USA") to canonical names. */
export function canonicalCountry(value: string | null | undefined): string {
  if (!value) return 'United States';
  const v = value.trim().toLowerCase();
  if (['us', 'usa', 'u.s.', 'u.s.a.', 'united states', 'united states of america'].includes(v)) return 'United States';
  if (['uk', 'gb', 'united kingdom', 'great britain'].includes(v)) return 'United Kingdom';
  if (['ca', 'canada'].includes(v)) return 'Canada';
  // Try to match a known canonical country name
  for (const country of Object.keys(COUNTRY_MARKERS)) {
    if (country.toLowerCase() === v) return country;
  }
  return value.trim();
}

/** True when the location is clearly in a different country than the user's. */
export function isForeignLocation(location: string | null | undefined, userCountry = 'United States'): boolean {
  const detected = detectCountry(location);
  return detected !== null && detected !== userCountry;
}

/** Detect a US state (as abbreviation) from a free-text job location. */
export function detectUSState(location: string | null | undefined): string | null {
  if (!location) return null;
  const abbrevMatch = location.match(/,\s*([A-Z]{2})(?:\s+\d{5})?\s*(?:,|$|\s)/);
  if (abbrevMatch && US_STATE_ABBREVS.includes(abbrevMatch[1])) return abbrevMatch[1];
  const loc = location.toLowerCase();
  for (let i = 0; i < US_STATE_NAMES.length; i++) {
    if (new RegExp(`(^|[\\s,])${US_STATE_NAMES[i]}($|[\\s,)])`).test(loc)) return US_STATE_ABBREVS[i];
  }
  return null;
}

// Adjacent-state map for "my region" relocation scope.
const STATE_NEIGHBORS: Record<string, string[]> = {
  AL: ['FL', 'GA', 'MS', 'TN'], AK: [], AZ: ['CA', 'CO', 'NM', 'NV', 'UT'],
  AR: ['LA', 'MO', 'MS', 'OK', 'TN', 'TX'], CA: ['AZ', 'NV', 'OR'],
  CO: ['AZ', 'KS', 'NE', 'NM', 'OK', 'UT', 'WY'], CT: ['MA', 'NY', 'RI'],
  DE: ['MD', 'NJ', 'PA'], FL: ['AL', 'GA'], GA: ['AL', 'FL', 'NC', 'SC', 'TN'],
  HI: [], ID: ['MT', 'NV', 'OR', 'UT', 'WA', 'WY'], IL: ['IA', 'IN', 'KY', 'MO', 'WI'],
  IN: ['IL', 'KY', 'MI', 'OH'], IA: ['IL', 'MN', 'MO', 'NE', 'SD', 'WI'],
  KS: ['CO', 'MO', 'NE', 'OK'], KY: ['IL', 'IN', 'MO', 'OH', 'TN', 'VA', 'WV'],
  LA: ['AR', 'MS', 'TX'], ME: ['NH'], MD: ['DE', 'PA', 'VA', 'WV', 'DC'],
  MA: ['CT', 'NH', 'NY', 'RI', 'VT'], MI: ['IN', 'OH', 'WI'],
  MN: ['IA', 'ND', 'SD', 'WI'], MS: ['AL', 'AR', 'LA', 'TN'],
  MO: ['AR', 'IA', 'IL', 'KS', 'KY', 'NE', 'OK', 'TN'], MT: ['ID', 'ND', 'SD', 'WY'],
  NE: ['CO', 'IA', 'KS', 'MO', 'SD', 'WY'], NV: ['AZ', 'CA', 'ID', 'OR', 'UT'],
  NH: ['MA', 'ME', 'VT'], NJ: ['DE', 'NY', 'PA', 'CT'], NM: ['AZ', 'CO', 'OK', 'TX'],
  NY: ['CT', 'MA', 'NJ', 'PA', 'VT'], NC: ['GA', 'SC', 'TN', 'VA'],
  ND: ['MN', 'MT', 'SD'], OH: ['IN', 'KY', 'MI', 'PA', 'WV'],
  OK: ['AR', 'CO', 'KS', 'MO', 'NM', 'TX'], OR: ['CA', 'ID', 'NV', 'WA'],
  PA: ['DE', 'MD', 'NJ', 'NY', 'OH', 'WV'], RI: ['CT', 'MA'],
  SC: ['GA', 'NC'], SD: ['IA', 'MN', 'MT', 'ND', 'NE', 'WY'],
  TN: ['AL', 'AR', 'GA', 'KY', 'MO', 'MS', 'NC', 'VA'], TX: ['AR', 'LA', 'NM', 'OK'],
  UT: ['AZ', 'CO', 'ID', 'NV', 'WY'], VT: ['MA', 'NH', 'NY'],
  VA: ['KY', 'MD', 'NC', 'TN', 'WV', 'DC'], WA: ['ID', 'OR'],
  WV: ['KY', 'MD', 'OH', 'PA', 'VA'], WI: ['IA', 'IL', 'MI', 'MN'], WY: ['CO', 'ID', 'MT', 'NE', 'SD', 'UT'],
  DC: ['MD', 'VA'],
};

/**
 * The states an on-site job may be in, given the user's home state and
 * relocation scope. Returns null when no state restriction applies
 * (national/international scope, or unknown home state).
 */
export function allowedStatesFor(homeState: string | null | undefined, scope: RelocationScope): Set<string> | null {
  const home = (homeState || '').trim().toUpperCase();
  if (!home || !US_STATE_ABBREVS.includes(home)) return null;
  if (scope === 'national' || scope === 'international') return null;
  if (scope === 'none') return new Set([home, ...(STATE_NEIGHBORS[home] || [])]);
  // regional: home + neighbors + neighbors-of-neighbors
  const allowed = new Set([home, ...(STATE_NEIGHBORS[home] || [])]);
  for (const n of STATE_NEIGHBORS[home] || []) for (const nn of STATE_NEIGHBORS[n] || []) allowed.add(nn);
  return allowed;
}

/**
 * The relocation scopes the product offers. Stored in
 * JobPreferences.relocationNote as a machine-readable token.
 */
export type RelocationScope = 'none' | 'regional' | 'national' | 'international';

export function parseRelocationScope(note: string | null | undefined, willingToRelocate?: boolean): RelocationScope {
  if (note === 'none' || note === 'regional' || note === 'national' || note === 'international') return note;
  // Legacy data: only a boolean was stored
  return willingToRelocate ? 'national' : 'none';
}
