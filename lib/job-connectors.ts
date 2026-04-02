/**
 * Greenhouse Job Connector
 * Fetches public job postings from Greenhouse's job board API.
 * No authentication required for public boards.
 *
 * API: https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true
 */

import { prisma } from '@/lib/db';
import crypto from 'crypto';

interface GreenhouseJob {
  id: number;
  title: string;
  updated_at: string;
  location: { name: string };
  content: string;  // HTML job description
  absolute_url: string;
  departments: Array<{ name: string }>;
  offices: Array<{ name: string }>;
  metadata?: Array<{ id: number; name: string; value: string | null }>;
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[];
  meta: { total: number };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function detectRemote(text: string, location: string): { isRemote: boolean; isHybrid: boolean } {
  const combined = `${text} ${location}`.toLowerCase();
  const isRemote = /\bremote\b/.test(combined) && !/\bon.?site\b/.test(combined);
  const isHybrid = /\bhybrid\b/.test(combined) || (/\bremote\b/.test(combined) && /\bon.?site\b/.test(combined));
  return { isRemote: isRemote && !isHybrid, isHybrid };
}

function makeDedupeKey(company: string, title: string, location: string): string {
  const normalized = `${company.toLowerCase().trim()}|${title.toLowerCase().trim()}|${location.toLowerCase().trim()}`;
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function detectRoleFamilies(title: string, description: string): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const families: string[] = [];

  if (/analyst|analytics|data|bi |business intelligence|reporting|sql|tableau|looker/.test(text)) families.push('analytics');
  if (/operations|ops |process|workflow|efficiency|coordination/.test(text)) families.push('ops');
  if (/customer success|customer experience|cx |client|account manager|support/.test(text)) families.push('cx');
  if (/implementation|onboarding|deployment|integration|technical.*account/.test(text)) families.push('implementation');
  if (/fintech|financial|payments|banking|lending|wealth/.test(text)) families.push('fintech');
  if (/crypto|blockchain|web3|defi|solana|ethereum|token/.test(text)) families.push('crypto');
  if (/product|roadmap|stakeholder.*product|product.*manager/.test(text)) families.push('product_adjacent');
  if (/machine learning|ml |ai |artificial intelligence|nlp|llm/.test(text)) families.push('ai_ml');
  if (/automation|automat|rpa|workflow.*auto|zapier|make\.com/.test(text)) families.push('automation');
  if (/growth|revenue|strategy|go.to.market|gtm|business development/.test(text)) families.push('growth');
  if (/it |systems|infrastructure|network|sysadmin/.test(text)) families.push('it');
  if (/startup|early.stage|seed|series [abc]/.test(text)) families.push('startup');

  return [...new Set(families)];
}

export async function syncGreenhouseBoard(
  userId: string,
  boardToken: string,
  scrapeRunId: string
): Promise<{ jobsFound: number; jobsNew: number; jobsDuped: number }> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Careeva/1.0 (job-aggregator)' },
  });

  if (!res.ok) {
    throw new Error(`Greenhouse API error: ${res.status} for board ${boardToken}`);
  }

  const data: GreenhouseResponse = await res.json();
  const jobs = data.jobs || [];

  let jobsNew = 0;
  let jobsDuped = 0;

  // Extract company name from board token (best-effort)
  const company = boardToken.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  for (const ghJob of jobs) {
    const location = ghJob.location?.name || '';
    const description = stripHtml(ghJob.content || '');
    const { isRemote, isHybrid } = detectRemote(description, location);
    const roleFamilies = detectRoleFamilies(ghJob.title, description);
    const dedupeKey = makeDedupeKey(company, ghJob.title, location);

    // Check for duplicate
    const existing = await prisma.job.findFirst({
      where: { userId, dedupeKey },
      select: { id: true },
    });

    if (existing) {
      // Update freshness
      await prisma.job.update({
        where: { id: existing.id },
        data: { lastScrapedAt: new Date(), isActive: true },
      });
      jobsDuped++;
      continue;
    }

    // Create new job
    await prisma.job.create({
      data: {
        userId,
        title: ghJob.title,
        company,
        description,
        requirements: '',  // Greenhouse embeds requirements in description
        location,
        isRemote,
        isHybrid,
        jobType: isRemote ? 'remote' : isHybrid ? 'hybrid' : 'onsite',
        url: ghJob.absolute_url,
        applyUrl: ghJob.absolute_url,
        source: 'greenhouse',
        atsType: 'greenhouse',
        externalId: String(ghJob.id),
        dedupeKey,
        roleFamilies,
        postedAt: ghJob.updated_at ? new Date(ghJob.updated_at) : undefined,
        isActive: true,
        lastScrapedAt: new Date(),
        scrapeRunId,
      },
    });

    jobsNew++;
  }

  return { jobsFound: jobs.length, jobsNew, jobsDuped };
}

/**
 * Lever Connector
 * Uses Lever's public posting API.
 * https://api.lever.co/v0/postings/{company}?mode=json
 */

interface LeverPosting {
  id: string;
  text: string;              // job title
  hostedUrl: string;
  applyUrl: string;
  createdAt: number;
  categories: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
  };
  description: string;       // HTML
  descriptionPlain: string;
  lists: Array<{ text: string; content: string }>;
  additional: string;
  additionalPlain: string;
}

export async function syncLeverBoard(
  userId: string,
  companySlug: string,
  scrapeRunId: string
): Promise<{ jobsFound: number; jobsNew: number; jobsDuped: number }> {
  const url = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Careeva/1.0 (job-aggregator)' },
  });

  if (!res.ok) {
    throw new Error(`Lever API error: ${res.status} for company ${companySlug}`);
  }

  const postings: LeverPosting[] = await res.json();

  let jobsNew = 0;
  let jobsDuped = 0;

  const company = companySlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  for (const posting of postings) {
    const location = posting.categories?.location || '';
    const description = posting.descriptionPlain || stripHtml(posting.description || '');
    const requirementsList = (posting.lists || [])
      .map(l => `${l.text}:\n${stripHtml(l.content)}`)
      .join('\n\n');

    const { isRemote, isHybrid } = detectRemote(description, location);
    const roleFamilies = detectRoleFamilies(posting.text, description);
    const dedupeKey = makeDedupeKey(company, posting.text, location);

    const existing = await prisma.job.findFirst({
      where: { userId, dedupeKey },
      select: { id: true },
    });

    if (existing) {
      await prisma.job.update({
        where: { id: existing.id },
        data: { lastScrapedAt: new Date(), isActive: true },
      });
      jobsDuped++;
      continue;
    }

    await prisma.job.create({
      data: {
        userId,
        title: posting.text,
        company,
        description,
        requirements: requirementsList,
        location,
        isRemote,
        isHybrid,
        jobType: isRemote ? 'remote' : isHybrid ? 'hybrid' : 'onsite',
        url: posting.hostedUrl,
        applyUrl: posting.applyUrl,
        source: 'lever',
        atsType: 'lever',
        externalId: posting.id,
        dedupeKey,
        roleFamilies,
        postedAt: posting.createdAt ? new Date(posting.createdAt) : undefined,
        isActive: true,
        lastScrapedAt: new Date(),
        scrapeRunId,
      },
    });

    jobsNew++;
  }

  return { jobsFound: postings.length, jobsNew, jobsDuped };
}

/**
 * Multi-source job sync runner
 * Creates a scrape run, syncs all configured sources, updates run record.
 */
export async function runJobSync(
  userId: string,
  sources: Array<{ type: 'greenhouse' | 'lever'; slug: string }>
): Promise<{ scrapeRunId: string; results: Record<string, unknown> }> {
  const scrapeRun = await prisma.scrapeRun.create({
    data: { userId, source: 'multi', status: 'running', startedAt: new Date() },
  });

  const results: Record<string, { jobsFound: number; jobsNew: number; jobsDuped: number } | { error: string }> = {};
  let totalFound = 0;
  let totalNew = 0;
  let totalDuped = 0;

  for (const source of sources) {
    try {
      let result: { jobsFound: number; jobsNew: number; jobsDuped: number };
      if (source.type === 'greenhouse') {
        result = await syncGreenhouseBoard(userId, source.slug, scrapeRun.id);
      } else {
        result = await syncLeverBoard(userId, source.slug, scrapeRun.id);
      }
      results[`${source.type}:${source.slug}`] = result;
      totalFound += result.jobsFound;
      totalNew += result.jobsNew;
      totalDuped += result.jobsDuped;
    } catch (err) {
      results[`${source.type}:${source.slug}`] = { error: err instanceof Error ? err.message : String(err) };
    }
  }

  await prisma.scrapeRun.update({
    where: { id: scrapeRun.id },
    data: {
      status: 'complete',
      completedAt: new Date(),
      jobsFound: totalFound,
      jobsNew: totalNew,
      jobsDuped: totalDuped,
    },
  });

  return { scrapeRunId: scrapeRun.id, results };
}
