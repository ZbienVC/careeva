/**
 * lib/job-connectors.ts (v2)
 *
 * Direct ATS connectors: Greenhouse, Lever, Ashby
 * - Parallel fetching for speed
 * - Proper company name lookup (not slug inference)
 * - Stale job cleanup
 * - Error isolation per board
 */

import { prisma } from '@/lib/db';
import crypto from 'crypto';

// ─── Company name lookup ──────────────────────────────────────────────────────
// Maps ATS slug → proper display name

const COMPANY_NAMES: Record<string, string> = {
  // Greenhouse
  'anthropic': 'Anthropic', 'openai': 'OpenAI', 'stripe': 'Stripe',
  'notion': 'Notion', 'figma': 'Figma', 'linear': 'Linear',
  'vercel': 'Vercel', 'supabase': 'Supabase', 'retool': 'Retool',
  'plaid': 'Plaid', 'brex': 'Brex', 'chime': 'Chime',
  'robinhood': 'Robinhood', 'coinbase': 'Coinbase', 'affirm': 'Affirm',
  'airbnb': 'Airbnb', 'lyft': 'Lyft', 'doordash': 'DoorDash',
  'reddit': 'Reddit', 'scale': 'Scale AI', 'cohere': 'Cohere',
  'huggingface': 'Hugging Face', 'runway': 'Runway', 'mistral': 'Mistral AI',
  'perplexity': 'Perplexity AI', 'dbt-labs': 'dbt Labs',
  'databricks': 'Databricks', 'snowflake': 'Snowflake',
  'amplitude': 'Amplitude', 'mixpanel': 'Mixpanel', 'segment': 'Segment',
  'intercom': 'Intercom', 'hubspot': 'HubSpot', 'zendesk': 'Zendesk',
  'monday': 'Monday.com', 'asana': 'Asana', 'loom': 'Loom',
  'coda': 'Coda', 'cursor': 'Cursor', 'elevenlabs': 'ElevenLabs',
  'chainalysis': 'Chainalysis', 'alchemy': 'Alchemy', 'dydx': 'dYdX',
  'ripple': 'Ripple', 'kraken': 'Kraken', 'marqeta': 'Marqeta',
  'instacart': 'Instacart',
  // Lever
  'rippling': 'Rippling', 'lattice': 'Lattice', 'canva': 'Canva',
  'airtable': 'Airtable', 'miro': 'Miro', 'pitch': 'Pitch',
  'superhuman': 'Superhuman', 'mercury': 'Mercury', 'netflix': 'Netflix',
  'slack': 'Slack', 'dropbox': 'Dropbox', 'square': 'Square',
  'klarna': 'Klarna', 'nubank': 'Nubank', 'wise': 'Wise',
  'gitlab': 'GitLab', 'hashicorp': 'HashiCorp', 'datadog': 'Datadog',
  'atlassian': 'Atlassian', 'pagerduty': 'PagerDuty', 'shopify': 'Shopify',
  'flexport': 'Flexport',
  // Ashby-only entries (elevenlabs/cursor/mistral/cohere already above)
  'luma': 'Luma AI', 'vapi': 'Vapi', 'windsurf': 'Windsurf', 'glean': 'Glean',
  'arizeai': 'Arize AI', 'langchain': 'LangChain', 'llamaindex': 'LlamaIndex',
  'modal': 'Modal', 'replicate': 'Replicate', 'together': 'Together AI',
  'fireworks': 'Fireworks AI', 'groq': 'Groq', 'cerebras': 'Cerebras',
  'adept': 'Adept', 'inflection': 'Inflection AI', 'characterai': 'Character.AI',
  'harvey': 'Harvey', 'sierra': 'Sierra', 'imbue': 'Imbue',
  'poolside': 'Poolside', 'cognition': 'Cognition', 'factory': 'Factory',
  'devin': 'Cognition (Devin)', 'codegen': 'Codegen', 'tabnine': 'Tabnine',
  // Additional companies from expanded boards
  'wandb': 'Weights & Biases', 'palantir': 'Palantir', 'deepgram': 'Deepgram',
  'bland': 'Bland AI', 'decagon': 'Decagon', 'lindy': 'Lindy',
  'pinecone': 'Pinecone', 'resend': 'Resend', 'clerk': 'Clerk',
  'inngest': 'Inngest', 'workos': 'WorkOS', 'attio': 'Attio',
  'tinybird': 'Tinybird', 'AlephAlpha': 'Aleph Alpha', 'DeepL': 'DeepL',
  'n8n': 'n8n', 'zapier': 'Zapier', 'synthesia': 'Synthesia',
  'faculty': 'Faculty AI', 'lovable': 'Lovable', 'legora': 'Legora',
  'photoroom': 'Photoroom', 'lakera.ai': 'Lakera', 'cradlebio': 'Cradle Bio',
  'causaly': 'Causaly', 'qonto': 'Qonto', 'forto': 'Forto',
  'pigment': 'Pigment', 'vinted': 'Vinted', 'spotify': 'Spotify',
  'clarity-ai': 'Clarity AI', 'wandb': 'Weights & Biases',
  'mistral': 'Mistral AI', 'runwayml': 'Runway', 'humeai': 'Hume AI',
  'blackforestlabs': 'Black Forest Labs', 'speechmatics': 'Speechmatics',
  'isomorphiclabs': 'Isomorphic Labs', 'physicsx': 'PhysicsX',
  'wayve': 'Wayve', 'amplemarket': 'Amplemarket', 'gleanwork': 'Glean',
  'hightouch': 'Hightouch', 'planetscale': 'PlanetScale',
  'celonis': 'Celonis', 'contentful': 'Contentful',
  'getyourguide': 'GetYourGuide', 'hellofresh': 'HelloFresh',
  'traderepublicbank': 'Trade Republic', 'sumup': 'SumUp',
  'arizeai': 'Arize AI', 'runpod': 'RunPod', 'temporal': 'Temporal',
  'factorial': 'Factorial', 'scandit': 'Scandit', 'polyai': 'PolyAI',
  'parloa': 'Parloa', 'humeai': 'Hume AI',
};

function getCompanyName(slug: string): string {
  return COMPANY_NAMES[slug.toLowerCase()] ??
    slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Top company boards hardcoded for Zach (SWE/AI/startup focus) ─────────────

export const TOP_GREENHOUSE_BOARDS = [
  // AI Labs
  'anthropic', 'scale', 'runway', 'runwayml', 'humeai',
  'blackforestlabs', 'speechmatics', 'stabilityai', 'isomorphiclabs',
  'physicsx', 'wayve', 'amplemarket', 'gleanwork', 'hightouch', 'planetscale',
  'celonis', 'contentful', 'getyourguide', 'hellofresh',
  'n26', 'traderepublicbank', 'sumup',
  'helsinki', 'arizeai', 'runpod', 'temporal',
  'factorial', 'scandit', 'polyai', 'parloa',
  // Core Tech/Startup
  'stripe', 'plaid', 'brex', 'marqeta', 'affirm', 'robinhood', 'coinbase',
  'notion', 'figma', 'linear', 'vercel', 'retool', 'loom', 'coda',
  'airbnb', 'reddit', 'lyft', 'doordash', 'instacart',
  'databricks', 'snowflake', 'amplitude', 'mixpanel', 'segment', 'dbt-labs',
  'intercom', 'hubspot', 'monday', 'asana', 'chainalysis', 'alchemy',
];

export const TOP_LEVER_BOARDS = [
  // Core
  'rippling', 'lattice', 'canva', 'airtable', 'miro',
  'mercury', 'klarna', 'nubank', 'wise',
  'gitlab', 'datadog', 'atlassian', 'hashicorp',
  'square', 'shopify', 'flexport', 'pitch', 'superhuman',
  // AI/ML
  'mistral', 'wandb', 'palantir',
  // EU
  'qonto', 'forto', 'pigment', 'vinted', 'spotify',
  // Clarity AI
  'clarity-ai',
];

export const TOP_ASHBY_BOARDS = [
  // Voice AI
  'elevenlabs', 'vapi', 'deepgram', 'bland',
  // AI platforms
  'cursor', 'luma', 'glean', 'perplexity', 'sierra', 'decagon',
  // AI infra
  'modal', 'replicate', 'together', 'fireworks', 'groq', 'cerebras',
  'langchain', 'llamaindex', 'pinecone',
  // Legal/enterprise AI
  'harvey', 'cognition', 'factory',
  // Dev tools
  'supabase', 'resend', 'clerk', 'inngest', 'workos', 'attio', 'tinybird',
  // EU AI
  'AlephAlpha', 'DeepL', 'n8n', 'zapier', 'travelperk',
  'synthesia', 'faculty', 'lovable', 'legora',
  'photoroom', 'lakera.ai', 'cradlebio', 'causaly',
  // Automation
  'lindy', 'cohere',
];

// ─── Shared utilities ─────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n').trim();
}

function detectRemote(text: string, location: string): { isRemote: boolean; isHybrid: boolean } {
  const combined = `${text} ${location}`.toLowerCase();
  const isHybrid = /\bhybrid\b/.test(combined);
  const isRemote = !isHybrid && /\bremote\b/.test(combined);
  return { isRemote, isHybrid };
}

function makeDedupeKey(company: string, title: string, location: string): string {
  const normalized = `${company.toLowerCase().trim()}|${title.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function detectRoleFamilies(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const families: string[] = [];
  if (/analyst|analytics|data|bi |business intelligence|sql|tableau|looker/.test(text)) families.push('analytics');
  if (/operations|ops |process|workflow/.test(text)) families.push('ops');
  if (/customer success|cx |client|account manager/.test(text)) families.push('cx');
  if (/fintech|financial|payments|banking/.test(text)) families.push('fintech');
  if (/crypto|blockchain|web3|defi|solana|ethereum/.test(text)) families.push('crypto');
  if (/machine learning|ml |ai |llm|nlp|artificial intelligence/.test(text)) families.push('ai_ml');
  if (/automation|automat|workflow.*auto/.test(text)) families.push('automation');
  if (/growth|revenue|strategy|go.to.market|gtm/.test(text)) families.push('growth');
  if (/software engineer|full.?stack|backend|frontend|mobile|platform|infrastructure/.test(text)) families.push('engineering');
  if (/product manager|product owner|roadmap|discovery/.test(text)) families.push('product');
  return [...new Set(families)];
}

async function upsertJob(userId: string, scrapeRunId: string, jobData: {
  title: string; company: string; description: string; requirements: string;
  location: string; isRemote: boolean; isHybrid: boolean;
  url: string; applyUrl: string; source: string; atsType: string;
  externalId?: string; salary?: string; salaryMin?: number; salaryMax?: number;
  postedAt?: Date;
}): Promise<'new' | 'duped'> {
  const { isRemote, isHybrid, title, company, location } = jobData;
  const dedupeKey = makeDedupeKey(company, title, location);
  const roleFamilies = detectRoleFamilies(title, jobData.description);

  const existing = await prisma.job.findFirst({ where: { userId, dedupeKey }, select: { id: true } });

  if (existing) {
    await prisma.job.update({
      where: { id: existing.id },
      data: { lastScrapedAt: new Date(), isActive: true },
    });
    return 'duped';
  }

  await prisma.job.create({
    data: {
      userId, scrapeRunId,
      title, company,
      description: jobData.description.slice(0, 5000),
      requirements: jobData.requirements.slice(0, 3000),
      location, isRemote, isHybrid,
      jobType: isRemote ? 'remote' : isHybrid ? 'hybrid' : 'onsite',
      url: jobData.url, applyUrl: jobData.applyUrl,
      source: jobData.source, atsType: jobData.atsType,
      externalId: jobData.externalId,
      dedupeKey, roleFamilies,
      salary: jobData.salary,
      salaryMin: jobData.salaryMin,
      salaryMax: jobData.salaryMax,
      postedAt: jobData.postedAt,
      isActive: true, lastScrapedAt: new Date(),
    },
  });
  return 'new';
}

// ─── Greenhouse connector ─────────────────────────────────────────────────────

export async function syncGreenhouseBoard(
  userId: string, boardToken: string, scrapeRunId: string
): Promise<{ jobsFound: number; jobsNew: number; jobsDuped: number }> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Careeva/1.0 job-aggregator' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Greenhouse ${boardToken}: HTTP ${res.status}`);

  const data = await res.json();
  const jobs = data.jobs || [];
  const company = getCompanyName(boardToken);

  let jobsNew = 0, jobsDuped = 0;
  for (const job of jobs) {
    const location = job.location?.name || 'Remote';
    const description = stripHtml(job.content || '');
    const { isRemote, isHybrid } = detectRemote(description, location);
    const result = await upsertJob(userId, scrapeRunId, {
      title: job.title, company, description, requirements: '',
      location, isRemote, isHybrid,
      url: job.absolute_url, applyUrl: job.absolute_url,
      source: 'greenhouse', atsType: 'greenhouse',
      externalId: String(job.id),
      postedAt: job.updated_at ? new Date(job.updated_at) : undefined,
    });
    if (result === 'new') jobsNew++; else jobsDuped++;
  }
  return { jobsFound: jobs.length, jobsNew, jobsDuped };
}

// ─── Lever connector ──────────────────────────────────────────────────────────

export async function syncLeverBoard(
  userId: string, companySlug: string, scrapeRunId: string
): Promise<{ jobsFound: number; jobsNew: number; jobsDuped: number }> {
  const url = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Careeva/1.0 job-aggregator' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Lever ${companySlug}: HTTP ${res.status}`);

  const postings = await res.json();
  if (!Array.isArray(postings)) return { jobsFound: 0, jobsNew: 0, jobsDuped: 0 };

  const company = getCompanyName(companySlug);
  let jobsNew = 0, jobsDuped = 0;

  for (const posting of postings) {
    const location = posting.categories?.location || 'Remote';
    const description = posting.descriptionPlain || stripHtml(posting.description || '');
    const requirements = (posting.lists || []).map((l: any) => `${l.text}:\n${stripHtml(l.content)}`).join('\n\n');
    const { isRemote, isHybrid } = detectRemote(description, location);

    const result = await upsertJob(userId, scrapeRunId, {
      title: posting.text, company, description, requirements,
      location, isRemote, isHybrid,
      url: posting.hostedUrl, applyUrl: posting.applyUrl,
      source: 'lever', atsType: 'lever',
      externalId: posting.id,
      postedAt: posting.createdAt ? new Date(posting.createdAt) : undefined,
    });
    if (result === 'new') jobsNew++; else jobsDuped++;
  }
  return { jobsFound: postings.length, jobsNew, jobsDuped };
}

// ─── Ashby connector (NEW) ────────────────────────────────────────────────────

interface AshbyPosting {
  id: string;
  title: string;
  locationName: string;
  employmentType: string;
  compensationTierSummary?: string;
  isRemote?: boolean;
  publishedDate?: string;
}

export async function syncAshbyBoard(
  userId: string, orgSlug: string, scrapeRunId: string
): Promise<{ jobsFound: number; jobsNew: number; jobsDuped: number }> {
  const url = `https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams`;
  const body = JSON.stringify({
    operationName: 'ApiJobBoardWithTeams',
    variables: { organizationHostedJobsPageName: orgSlug },
    query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
      jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
        jobPostings {
          id title locationName employmentType compensationTierSummary isRemote publishedDate
          descriptionSafe
          jobPostingLocations { location { name } }
        }
      }
    }`,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'Careeva/1.0 job-aggregator' },
    body,
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Ashby ${orgSlug}: HTTP ${res.status}`);

  const data = await res.json();
  const postings: AshbyPosting[] = data?.data?.jobBoard?.jobPostings || [];
  const company = getCompanyName(orgSlug);

  let jobsNew = 0, jobsDuped = 0;

  for (const posting of postings) {
    const location = posting.locationName || (posting.isRemote ? 'Remote' : 'Unknown');
    const description = stripHtml((posting as any).descriptionSafe || '');
    const salary = posting.compensationTierSummary || undefined;
    const { isRemote, isHybrid } = detectRemote(description, location);
    const jobUrl = `https://jobs.ashbyhq.com/${orgSlug}/${posting.id}`;

    const result = await upsertJob(userId, scrapeRunId, {
      title: posting.title, company, description, requirements: '',
      location, isRemote: isRemote || !!posting.isRemote, isHybrid,
      url: jobUrl, applyUrl: jobUrl,
      source: 'ashby', atsType: 'ashby',
      externalId: posting.id, salary,
      postedAt: posting.publishedDate ? new Date(posting.publishedDate) : undefined,
    });
    if (result === 'new') jobsNew++; else jobsDuped++;
  }
  return { jobsFound: postings.length, jobsNew, jobsDuped };
}

// ─── Parallel multi-board sync ────────────────────────────────────────────────

export async function runJobSync(
  userId: string,
  sources: Array<{ type: 'greenhouse' | 'lever' | 'ashby'; slug: string }>
): Promise<{ scrapeRunId: string; results: Record<string, unknown>; totalNew: number }> {
  const scrapeRun = await prisma.scrapeRun.create({
    data: { userId, source: 'multi', status: 'running', startedAt: new Date() },
  });

  // Run all boards in parallel (batched to avoid overwhelming connections)
  const BATCH_SIZE = 5;
  const results: Record<string, { jobsFound: number; jobsNew: number; jobsDuped: number } | { error: string }> = {};
  let totalFound = 0, totalNew = 0, totalDuped = 0;

  for (let i = 0; i < sources.length; i += BATCH_SIZE) {
    const batch = sources.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(
      batch.map(async (source) => {
        const key = `${source.type}:${source.slug}`;
        try {
          let result: { jobsFound: number; jobsNew: number; jobsDuped: number };
          if (source.type === 'greenhouse') result = await syncGreenhouseBoard(userId, source.slug, scrapeRun.id);
          else if (source.type === 'lever') result = await syncLeverBoard(userId, source.slug, scrapeRun.id);
          else result = await syncAshbyBoard(userId, source.slug, scrapeRun.id);
          return { key, result };
        } catch (err) {
          return { key, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    for (const s of settled) {
      if (s.status === 'fulfilled') {
        const { key, result, error } = s.value as any;
        if (error) { results[key] = { error }; }
        else {
          results[key] = result;
          totalFound += result.jobsFound;
          totalNew += result.jobsNew;
          totalDuped += result.jobsDuped;
        }
      }
    }
  }

  await prisma.scrapeRun.update({
    where: { id: scrapeRun.id },
    data: { status: 'complete', completedAt: new Date(), jobsFound: totalFound, jobsNew: totalNew, jobsDuped: totalDuped },
  });

  return { scrapeRunId: scrapeRun.id, results, totalNew };
}

// ─── Stale job cleanup ────────────────────────────────────────────────────────

export async function cleanupStaleJobs(userId: string): Promise<number> {
  const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000); // 45 days
  const result = await prisma.job.updateMany({
    where: {
      userId,
      isActive: true,
      source: { not: 'manual' },
      applications: { none: {} },
      OR: [
        { lastScrapedAt: { lt: cutoff } },
        { postedAt: { lt: cutoff } },
      ],
    },
    data: { isActive: false },
  });
  return result.count;
}
