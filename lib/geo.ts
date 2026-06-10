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
};

/**
 * Best-effort country detection from a free-text job location.
 * Returns the canonical country name, or null when undeterminable
 * (e.g. "Remote", "Various", or a bare city we don't recognize).
 */
export function detectCountry(location: string | null | undefined): string | null {
  if (!location) return null;
  const loc = location.toLowerCase().trim();
  if (!loc || /^(remote|anywhere|worldwide|global|various|flexible)/.test(loc)) return null;

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
