/**
 * lib/job-search.ts
 * Multi-source job search aggregator
 * 
 * Sources:
 * 1. SerpAPI Google Jobs (paid, free tier = 100 searches/month) - returns jobs from all major boards
 * 2. Remotive API (free, remote tech jobs)
 * 3. Greenhouse boards (public, no auth) 
 * 4. Lever boards (public, no auth)
 * 5. Adzuna API (free 250 calls/day, UK+US jobs)
 * 6. The Muse API (free, company culture + jobs)
 * 
 * No LinkedIn/Indeed scraping - TOS violations. Use their official feeds.
 */

import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

const SERP_API_KEY = process.env.SERP_API_KEY || '';
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID || '';
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY || '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  applyUrl: string;
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  isRemote: boolean;
  isHybrid: boolean;
  source: string;
  atsType?: string;
  externalId?: string;
  postedAt?: Date;
}

function makeDedupeKey(company: string, title: string, location: string): string {
  const s = `${company.toLowerCase().trim()}|${title.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
  return crypto.createHash('md5').update(s).digest('hex');
}

function detectATS(url: string): string | undefined {
  if (!url) return undefined;
  if (url.includes('greenhouse.io')) return 'greenhouse';
  if (url.includes('lever.co')) return 'lever';
  if (url.includes('workday.com') || url.includes('myworkdayjobs')) return 'workday';
  if (url.includes('ashbyhq.com')) return 'ashby';
  if (url.includes('smartrecruiters')) return 'smartrecruiters';
  if (url.includes('icims.com')) return 'icims';
  if (url.includes('taleo.net')) return 'taleo';
  if (url.includes('successfactors') || url.includes('sapsf')) return 'successfactors';
  return undefined;
}

// ─── Source 1: SerpAPI Google Jobs ───────────────────────────────────────────

async function searchGoogleJobs(query: string, location = 'United States', count = 50): Promise<SearchJob[]> {
  if (!SERP_API_KEY) {
    console.warn('[JobSearch] SERP_API_KEY not set - skipping Google Jobs');
    return [];
  }

  const params = new URLSearchParams({
    engine: 'google_jobs',
    q: query,
    location,
    hl: 'en',
    api_key: SERP_API_KEY,
    num: String(count),
  });

  try {
    const res = await fetch(`https://serpapi.com/search?${params}`);
    if (!res.ok) throw new Error(`SerpAPI error: ${res.status}`);
    const data = await res.json();

    return (data.jobs_results || []).map((job: any): SearchJob => {
      const applyUrl = job.apply_options?.[0]?.link || job.share_link || '';
      return {
        title: job.title || '',
        company: job.company_name || '',
        location: job.location || '',
        description: job.description || '',
        url: job.share_link || applyUrl,
        applyUrl,
        isRemote: /remote/i.test(job.location || ''),
        isHybrid: /hybrid/i.test(job.location || ''),
        source: 'google_jobs',
        atsType: detectATS(applyUrl),
        postedAt: job.detected_extensions?.posted_at ? new Date(job.detected_extensions.posted_at) : undefined,
      };
    });
  } catch (err) {
    console.error('[JobSearch] Google Jobs error:', err);
    return [];
  }
}

// ─── Source 2: Remotive (free remote tech jobs) ───────────────────────────────

async function searchRemotive(query: string): Promise<SearchJob[]> {
  try {
    const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=50`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Careeva/1.0 job-aggregator' } });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.jobs || []).map((job: any): SearchJob => ({
      title: job.title || '',
      company: job.company_name || '',
      location: job.candidate_required_location || 'Remote',
      description: (job.description || '').replace(/<[^>]+>/g, '').slice(0, 3000),
      url: job.url || '',
      applyUrl: job.url || '',
      salary: job.salary || undefined,
      isRemote: true,
      isHybrid: false,
      source: 'remotive',
      atsType: detectATS(job.url),
      postedAt: job.publication_date ? new Date(job.publication_date) : undefined,
    }));
  } catch (err) {
    console.error('[JobSearch] Remotive error:', err);
    return [];
  }
}

// ─── Source 3: Adzuna (free 250 calls/day) ────────────────────────────────────

async function searchAdzuna(query: string, location = 'us', pages = 2): Promise<SearchJob[]> {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) return [];

  const jobs: SearchJob[] = [];
  try {
    for (let page = 1; page <= pages; page++) {
      const url = `https://api.adzuna.com/v1/api/jobs/${location}/search/${page}?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=50&what=${encodeURIComponent(query)}&content-type=application/json`;
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      for (const job of (data.results || [])) {
        jobs.push({
          title: job.title || '',
          company: job.company?.display_name || '',
          location: job.location?.display_name || '',
          description: job.description || '',
          url: job.redirect_url || '',
          applyUrl: job.redirect_url || '',
          salaryMin: job.salary_min || undefined,
          salaryMax: job.salary_max || undefined,
          isRemote: /remote/i.test(job.title + job.description),
          isHybrid: /hybrid/i.test(job.title + job.description),
          source: 'adzuna',
          atsType: detectATS(job.redirect_url || ''),
          postedAt: job.created ? new Date(job.created) : undefined,
        });
      }
    }
  } catch (err) {
    console.error('[JobSearch] Adzuna error:', err);
  }
  return jobs;
}

// ─── Source 4: The Muse (free, good for company culture) ─────────────────────

async function searchTheMuse(query: string): Promise<SearchJob[]> {
  try {
    const url = `https://www.themuse.com/api/public/jobs?descending=true&page=1&query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Careeva/1.0' } });
    if (!res.ok) return [];
    const data = await res.json();

    return (data.results || []).slice(0, 30).map((job: any): SearchJob => ({
      title: job.name || '',
      company: job.company?.name || '',
      location: job.locations?.map((l: any) => l.name).join(', ') || 'Various',
      description: job.contents || '',
      url: job.refs?.landing_page || '',
      applyUrl: job.refs?.landing_page || '',
      isRemote: (job.locations || []).some((l: any) => /remote/i.test(l.name)),
      isHybrid: (job.locations || []).some((l: any) => /hybrid/i.test(l.name)),
      source: 'themuse',
      atsType: detectATS(job.refs?.landing_page || ''),
    }));
  } catch (err) {
    console.error('[JobSearch] The Muse error:', err);
    return [];
  }
}


// ─── Curated company boards by role family ────────────────────────────────────

export const CURATED_GREENHOUSE_BOARDS: Record<string, string[]> = {
  analytics: ['stripe', 'airbnb', 'lyft', 'coinbase', 'reddit', 'notion', 'figma', 'plaid', 'brex', 'chime'],
  fintech: ['stripe', 'plaid', 'brex', 'chime', 'robinhood', 'coinbase', 'affirm', 'marqeta', 'ripple'],
  crypto: ['coinbase', 'ripple', 'kraken', 'blockchain', 'alchemy', 'chainalysis', 'dydx'],
  ops: ['airbnb', 'lyft', 'doordash', 'instacart', 'notion', 'asana', 'monday'],
  ai_ml: ['anthropic', 'openai', 'cohere', 'huggingface', 'runway', 'scale'],
  saas: ['salesforce', 'hubspot', 'zendesk', 'intercom', 'segment', 'amplitude', 'mixpanel'],
  startup: ['notion', 'figma', 'linear', 'vercel', 'supabase', 'railway', 'retool'],
};

export const CURATED_LEVER_BOARDS: Record<string, string[]> = {
  analytics: ['netflix', 'twitter', 'slack', 'dropbox', 'square'],
  fintech: ['square', 'klarna', 'nubank', 'wise', 'monzo'],
  ops: ['square', 'shopify', 'shopify', 'flexport'],
  saas: ['atlassian', 'datadog', 'pagerduty', 'hashicorp'],
};

// ─── Source 5: Indeed RSS feed (free, no auth) ────────────────────────────────

async function searchIndeedRSS(query: string, location = 'United States'): Promise<SearchJob[]> {
  try {
    const url = `https://www.indeed.com/rss?q=${encodeURIComponent(query)}&l=${encodeURIComponent(location)}&sort=date&limit=50`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Careeva/1.0; job-aggregator)',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    
    // Parse RSS XML manually (no external parser needed)
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    return items.slice(0, 30).map(item => {
      const get = (tag: string) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`))?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
      const title = get('title');
      const link = get('link');
      const desc = get('description').replace(/<[^>]+>/g, '').slice(0, 2000);
      const company = get('source') || title.split(' at ').slice(-1)[0] || '';
      const jobTitle = title.includes(' at ') ? title.split(' at ')[0] : title;
      return {
        title: jobTitle,
        company,
        location: get('geo:point') || location,
        description: desc,
        url: link,
        applyUrl: link,
        isRemote: /remote/i.test(title + desc),
        isHybrid: /hybrid/i.test(title + desc),
        source: 'indeed',
        atsType: detectATS(link),
        postedAt: get('pubDate') ? new Date(get('pubDate')) : undefined,
      } as SearchJob;
    }).filter(j => j.title && j.url);
  } catch (err) {
    console.warn('[JobSearch] Indeed RSS error:', err);
    return [];
  }
}

// ─── Source 6: USAJobs (US government jobs, free API) ─────────────────────────

async function searchUSAJobs(query: string): Promise<SearchJob[]> {
  const USAJOBS_HOST = process.env.USAJOBS_HOST || '';
  const USAJOBS_KEY = process.env.USAJOBS_KEY || '';
  if (!USAJOBS_HOST || !USAJOBS_KEY) return [];
  try {
    const url = `https://data.usajobs.gov/api/search?Keyword=${encodeURIComponent(query)}&ResultsPerPage=25`;
    const res = await fetch(url, { headers: { 'Host': USAJOBS_HOST, 'User-Agent': USAJOBS_HOST, 'Authorization-Key': USAJOBS_KEY } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.SearchResult?.SearchResultItems || []).map((item: any) => {
      const pos = item.MatchedObjectDescriptor;
      return {
        title: pos?.PositionTitle || '',
        company: pos?.DepartmentName || 'US Government',
        location: pos?.PositionLocationDisplay || 'USA',
        description: pos?.QualificationSummary || '',
        url: pos?.PositionURI || '',
        applyUrl: pos?.ApplyURI?.[0] || pos?.PositionURI || '',
        isRemote: /remote/i.test(pos?.PositionLocationDisplay || ''),
        isHybrid: false,
        source: 'usajobs',
      } as SearchJob;
    });
  } catch { return []; }
}

// ─── Source 7: Arbeitnow (free, no auth, remote+EU+US tech jobs) ──────────────

async function searchArbeitnow(query: string): Promise<SearchJob[]> {
  try {
    const url = `https://www.arbeitnow.com/api/job-board-api?search=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Careeva/1.0 job-aggregator', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).slice(0, 20).map((job: any): SearchJob => ({
      title: job.title || '',
      company: job.company_name || '',
      location: job.location || 'Remote',
      description: job.description || '',
      url: job.url || '',
      applyUrl: job.url || '',
      isRemote: !!job.remote,
      isHybrid: false,
      source: 'arbeitnow',
      atsType: detectATS(job.url || ''),
      postedAt: job.created_at ? new Date(job.created_at * 1000) : undefined,
    }));
  } catch { return []; }
}

// ─── Source 8: We Work Remotely RSS (free, remote-only jobs) ─────────────────

async function searchWeWorkRemotely(query: string): Promise<SearchJob[]> {
  try {
    const url = `https://weworkremotely.com/remote-jobs.rss`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Careeva/1.0 job-aggregator' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    const qLow = query.toLowerCase();
    return items
      .map(item => {
        const get = (tag: string) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`))?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
        const title = get('title');
        const link = get('link') || get('url');
        const desc = get('description').replace(/<[^>]+>/g, '').slice(0, 2000);
        // WWR format: "Company: Job Title" in region
        const [companyRaw, jobTitleRaw] = title.includes(': ') ? title.split(': ') : ['', title];
        return {
          title: jobTitleRaw || title,
          company: companyRaw || 'Remote Company',
          location: 'Remote',
          description: desc,
          url: link,
          applyUrl: link,
          isRemote: true,
          isHybrid: false,
          source: 'weworkremotely',
          atsType: detectATS(link),
        } as SearchJob;
      })
      .filter(j => j.title && j.url && (j.title.toLowerCase().includes(qLow) || j.description.toLowerCase().includes(qLow)))
      .slice(0, 20);
  } catch { return []; }
}

// ─── Source 9: Authentic Jobs RSS (free, creative/tech roles) ────────────────

async function searchAuthenticJobs(query: string): Promise<SearchJob[]> {
  try {
    const url = `https://authenticjobs.com/api/?api_key=&method=aj.jobs.search&keywords=${encodeURIComponent(query)}&per_page=20&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.listings?.listing || []).map((job: any): SearchJob => ({
      title: job.title || '',
      company: job.company?.name || '',
      location: job.company?.location || '',
      description: job.description || '',
      url: job.url || '',
      applyUrl: job.url || '',
      isRemote: /remote/i.test(job.type || ''),
      isHybrid: false,
      source: 'authenticjobs',
      atsType: detectATS(job.url || ''),
    }));
  } catch { return []; }
}

// ─── Source 10: JSearch via RapidAPI free tier (60 calls/month free) ─────────
// Aggregates: LinkedIn, Indeed, ZipRecruiter, Glassdoor in one call
// User must add their own free RapidAPI key

async function searchJSearch(query: string, location = 'United States'): Promise<SearchJob[]> {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
  if (!RAPIDAPI_KEY) return [];
  try {
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query + ' in ' + location)}&page=1&num_pages=2&date_posted=week`;
    const res = await fetch(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'jsearch.p.rapidapi.com',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((job: any): SearchJob => ({
      title: job.job_title || '',
      company: job.employer_name || '',
      location: `${job.job_city || ''} ${job.job_state || ''} ${job.job_country || ''}`.trim(),
      description: job.job_description || '',
      url: job.job_apply_link || job.job_google_link || '',
      applyUrl: job.job_apply_link || '',
      salary: job.job_min_salary && job.job_max_salary ? `$${job.job_min_salary.toLocaleString()}–$${job.job_max_salary.toLocaleString()}` : undefined,
      salaryMin: job.job_min_salary || undefined,
      salaryMax: job.job_max_salary || undefined,
      isRemote: !!job.job_is_remote,
      isHybrid: false,
      source: 'jsearch',
      atsType: detectATS(job.job_apply_link || ''),
      postedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : undefined,
    }));
  } catch { return []; }
}

// ─── Source: Dice (free API, tech-focused) ───────────────────────────────────

async function searchDice(query: string, location = ''): Promise<SearchJob[]> {
  try {
    // Dice has a public search endpoint
    const params = new URLSearchParams({
      q: query,
      city: location,
      country: 'US',
      pageSize: '30',
      fields: 'id,title,companyName,location,employmentType,postedDate,applyUrl,jobDescription,skills',
    });
    const url = `https://job-search-api.svc.dhigroupinc.com/v1/dice/jobs/search?${params}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Careeva/1.0',
        'Accept': 'application/json',
        'x-api-key': 'sstbnhh59h9hnhh9hnhh9hnhh9hnhh9',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map((job: any): SearchJob => ({
      title: job.title || '',
      company: job.companyName || '',
      location: job.location || '',
      description: job.jobDescription || '',
      url: `https://www.dice.com/job-detail/${job.id}`,
      applyUrl: job.applyUrl || `https://www.dice.com/job-detail/${job.id}`,
      isRemote: /remote/i.test(job.workplaceTypes?.join(' ') || job.location || ''),
      isHybrid: /hybrid/i.test(job.workplaceTypes?.join(' ') || ''),
      source: 'dice',
      atsType: detectATS(job.applyUrl || ''),
      postedAt: job.postedDate ? new Date(job.postedDate) : undefined,
    }));
  } catch { return []; }
}

// ─── Source: Monster RSS (free, major US job board) ───────────────────────────

async function searchMonster(query: string, location = 'United States'): Promise<SearchJob[]> {
  try {
    const url = `https://www.monster.com/jobs/search?q=${encodeURIComponent(query)}&where=${encodeURIComponent(location)}&intcid=skr_navigation_nhpso_searchMain`;
    // Use RSS endpoint
    const rssUrl = `https://job-openings.monster.com/v2/jobs/rss?q=${encodeURIComponent(query)}&where=${encodeURIComponent(location)}`;
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Careeva/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    return items.slice(0, 25).map(item => {
      const get = (tag: string) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
      return {
        title: get('title'),
        company: get('name') || get('companyName') || '',
        location: get('city') || location,
        description: get('description').replace(/<[^>]+>/g, '').slice(0, 2000),
        url: get('link'),
        applyUrl: get('link'),
        isRemote: /remote/i.test(get('title') + get('description')),
        isHybrid: /hybrid/i.test(get('description')),
        source: 'monster',
        atsType: detectATS(get('link')),
      } as SearchJob;
    }).filter(j => j.title && j.url);
  } catch { return []; }
}

// ─── Source: Remote.co RSS (free, quality remote jobs) ───────────────────────

async function searchRemoteCo(query: string): Promise<SearchJob[]> {
  try {
    const url = `https://remote.co/remote-jobs/feed/`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Careeva/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
    const qLow = query.toLowerCase();
    return items
      .map(item => {
        const get = (tag: string) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '';
        const title = get('title');
        const desc = get('description').replace(/<[^>]+>/g, '').slice(0, 2000);
        const link = get('link');
        const category = get('category');
        return {
          title,
          company: get('author') || 'Remote Company',
          location: 'Remote',
          description: desc,
          url: link,
          applyUrl: link,
          isRemote: true,
          isHybrid: false,
          source: 'remoteco',
          atsType: detectATS(link),
        } as SearchJob;
      })
      .filter(j => j.title && j.url && (
        j.title.toLowerCase().includes(qLow) ||
        j.description.toLowerCase().includes(qLow)
      ))
      .slice(0, 20);
  } catch { return []; }
}

// ─── Source: Direct company career pages (ATS detection + crawl) ─────────────
// Supported: Greenhouse, Lever, Workday, Ashby - auto-detected from URL
// User can add custom company career page URLs in their preferences

async function crawlCompanyCareerPage(companyUrl: string, userId: string, scrapeRunId: string): Promise<number> {
  try {
    // Detect ATS type from URL and crawl accordingly
    if (companyUrl.includes('greenhouse.io') || companyUrl.includes('boards.greenhouse')) {
      const match = companyUrl.match(/boards(?:\.greenhouse\.io)?\/([^/]+)/);
      if (match) {
        const { syncGreenhouseBoard } = await import('./job-connectors');
        const result = await syncGreenhouseBoard(userId, match[1], scrapeRunId);
        return result.jobsNew;
      }
    }
    if (companyUrl.includes('lever.co') || companyUrl.includes('jobs.lever')) {
      const match = companyUrl.match(/lever\.co\/([^/?]+)/);
      if (match) {
        const { syncLeverBoard } = await import('./job-connectors');
        const result = await syncLeverBoard(userId, match[1], scrapeRunId);
        return result.jobsNew;
      }
    }
    // For Workday, Ashby, etc. - return 0 (not yet supported for direct crawl)
    return 0;
  } catch { return 0; }
}

export { crawlCompanyCareerPage };
// ─── Main search aggregator ───────────────────────────────────────────────────

export interface JobSearchParams {
  userId: string;
  queries: string[];          // e.g. ["data analyst", "operations manager"]
  locations?: string[];       // e.g. ["New York, NY", "Remote"]
  sources?: ('google' | 'remotive' | 'adzuna' | 'themuse' | 'greenhouse' | 'lever' | 'indeed' | 'usajobs' | 'arbeitnow' | 'weworkremotely' | 'authenticjobs' | 'jsearch' | 'dice' | 'monster' | 'remoteco')[];
  greenhouseBoards?: string[];
  leverBoards?: string[];
  companyCareerUrls?: string[];  // Direct company career page URLs
}

export async function aggregateJobSearch(params: JobSearchParams): Promise<{ total: number; new: number; duped: number }> {
  const {
    userId,
    queries,
    locations = ['United States'],
    sources = ['google', 'remotive', 'adzuna', 'themuse'],
    greenhouseBoards = [],
    leverBoards = [],
    companyCareerUrls = [],
  } = params;

  // Create scrape run
  const scrapeRun = await prisma.scrapeRun.create({
    data: { userId, source: 'multi', status: 'running', startedAt: new Date() },
  });

  let allJobs: SearchJob[] = [];

  // Collect from all sources
  for (const query of queries) {
    for (const location of locations) {
      if (sources.includes('google')) {
        const g = await searchGoogleJobs(query, location);
        allJobs = allJobs.concat(g);
      }
    }
    if (sources.includes('remotive')) {
      const r = await searchRemotive(query);
      allJobs = allJobs.concat(r);
    }
    if (sources.includes('adzuna')) {
      const a = await searchAdzuna(query);
      allJobs = allJobs.concat(a);
    }
    if (sources.includes('themuse')) {
      const m = await searchTheMuse(query);
      allJobs = allJobs.concat(m);
    }
    if (sources.includes('indeed')) {
      for (const location of locations) {
        const i = await searchIndeedRSS(query, location);
        allJobs = allJobs.concat(i);
      }
    }
    if (sources.includes('arbeitnow')) {
      const an = await searchArbeitnow(query);
      allJobs = allJobs.concat(an);
    }
    if (sources.includes('weworkremotely')) {
      const wwr = await searchWeWorkRemotely(query);
      allJobs = allJobs.concat(wwr);
    }
    if (sources.includes('jsearch')) {
      for (const location of locations) {
        const js = await searchJSearch(query, location);
        allJobs = allJobs.concat(js);
      }
    }
    if (sources.includes('dice')) {
      for (const location of locations.slice(0, 2)) {
        const d = await searchDice(query, location);
        allJobs = allJobs.concat(d);
      }
    }
    if (sources.includes('monster')) {
      for (const location of locations.slice(0, 2)) {
        const m = await searchMonster(query, location);
        allJobs = allJobs.concat(m);
      }
    }
    if (sources.includes('remoteco')) {
      const rc = await searchRemoteCo(query);
      allJobs = allJobs.concat(rc);
    }
  }

  // Greenhouse boards
  const { syncGreenhouseBoard, syncLeverBoard } = await import('./job-connectors');
  for (const board of greenhouseBoards) {
    try {
      await syncGreenhouseBoard(userId, board, scrapeRun.id);
    } catch { /* skip */ }
  }
  // Direct company career pages
  if (companyCareerUrls?.length) {
    for (const url of companyCareerUrls) {
      try {
        await crawlCompanyCareerPage(url, userId, scrapeRun.id);
      } catch { /* skip */ }
    }
  }
  
  for (const board of leverBoards) {
    try {
      await syncLeverBoard(userId, board, scrapeRun.id);
    } catch { /* skip */ }
  }

  // Deduplicate and save
  let newCount = 0;
  let dupedCount = 0;

  for (const job of allJobs) {
    if (!job.title || !job.company) continue;
    const dedupeKey = makeDedupeKey(job.company, job.title, job.location);

    const existing = await prisma.job.findFirst({ where: { userId, dedupeKey }, select: { id: true } });
    if (existing) {
      dupedCount++;
      await prisma.job.update({ where: { id: existing.id }, data: { lastScrapedAt: new Date(), isActive: true } });
      continue;
    }

    // Detect role families
    const text = `${job.title} ${job.description}`.toLowerCase();
    const roleFamilies: string[] = [];
    if (/analyst|analytics|data|sql|tableau/.test(text)) roleFamilies.push('analytics');
    if (/operations|ops |process/.test(text)) roleFamilies.push('ops');
    if (/customer success|cx |client|account/.test(text)) roleFamilies.push('cx');
    if (/fintech|financial|payments/.test(text)) roleFamilies.push('fintech');
    if (/crypto|blockchain|web3/.test(text)) roleFamilies.push('crypto');
    if (/machine learning|ml |ai |llm/.test(text)) roleFamilies.push('ai_ml');
    if (/automation|automat/.test(text)) roleFamilies.push('automation');

    await prisma.job.create({
      data: {
        userId,
        title: job.title,
        company: job.company,
        description: job.description.slice(0, 5000),
        requirements: '',
        location: job.location,
        isRemote: job.isRemote,
        isHybrid: job.isHybrid,
        jobType: job.isRemote ? 'remote' : job.isHybrid ? 'hybrid' : 'onsite',
        url: job.url,
        applyUrl: job.applyUrl,
        source: job.source,
        atsType: job.atsType,
        dedupeKey,
        roleFamilies,
        salary: job.salary,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        postedAt: job.postedAt,
        isActive: true,
        lastScrapedAt: new Date(),
        scrapeRunId: scrapeRun.id,
      },
    });
    newCount++;
  }

  await prisma.scrapeRun.update({
    where: { id: scrapeRun.id },
    data: { status: 'complete', completedAt: new Date(), jobsFound: allJobs.length, jobsNew: newCount, jobsDuped: dupedCount },
  });

  return { total: allJobs.length, new: newCount, duped: dupedCount };
}
