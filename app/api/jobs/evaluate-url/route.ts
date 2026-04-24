/**
 * app/api/jobs/evaluate-url/route.ts
 *
 * Paste any job URL → instant full evaluation (career-ops pipeline mode).
 * 1. Fetches the job page (public URLs only)
 * 2. Extracts title, company, description
 * 3. Saves as a Job record
 * 4. Runs the 7-block evaluation immediately
 * 5. Returns evaluation + job ID for the UI
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUserFromRequest } from '@/lib/session';
import { generate } from '@/lib/ai-client';
import crypto from 'crypto';

// Detect ATS from URL
function detectATS(url: string): string {
  if (/greenhouse\.io/.test(url)) return 'greenhouse';
  if (/lever\.co/.test(url)) return 'lever';
  if (/ashbyhq\.com/.test(url)) return 'ashby';
  if (/workday\.com/.test(url)) return 'workday';
  if (/workable\.com/.test(url)) return 'workable';
  if (/smartrecruiters\.com/.test(url)) return 'smartrecruiters';
  if (/icims\.com/.test(url)) return 'icims';
  return 'unknown';
}

// Fetch and extract job content from a URL
async function fetchJobContent(url: string): Promise<{ title: string; company: string; description: string; location: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Careeva/1.0; job-aggregator)',
      'Accept': 'text/html,application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error('Could not fetch job page: HTTP ' + res.status);

  const contentType = res.headers.get('content-type') || '';
  let rawText = '';

  // Handle JSON APIs (Greenhouse, Lever)
  if (contentType.includes('application/json')) {
    const data = await res.json();
    // Greenhouse format
    if (data.title && data.content) {
      return {
        title: data.title,
        company: data.company?.name || '',
        description: data.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 5000),
        location: data.location?.name || '',
      };
    }
    // Lever format
    if (data.text && data.description) {
      return {
        title: data.text,
        company: data.categories?.team || '',
        description: (data.descriptionPlain || data.description.replace(/<[^>]+>/g, ' ')).slice(0, 5000),
        location: data.categories?.location || '',
      };
    }
  }

  // HTML: extract key content using AI
  rawText = await res.text();
  // Strip scripts, styles, nav - keep main content
  const cleaned = rawText
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 8000);

  // Use AI to extract structured data from the page
  const extracted = await generate({
    task: 'job_analysis',
    maxTokens: 300,
    systemPrompt: 'Extract job posting data from web page text. Return ONLY valid JSON.',
    prompt: `Extract the job title, company name, location, and a 500-word description from this page text.
Return JSON: {"title": "...", "company": "...", "location": "...", "description": "..."}

Page text:
${cleaned}`,
  });

  try {
    const json = JSON.parse(extracted.replace(/```json\n?|```/g, '').trim());
    return {
      title: json.title || 'Unknown Role',
      company: json.company || 'Unknown Company',
      description: (json.description || cleaned.slice(0, 3000)),
      location: json.location || '',
    };
  } catch {
    // Fallback: return cleaned text
    return {
      title: 'Job Posting',
      company: new URL(url).hostname.replace('www.', '').replace('jobs.', ''),
      description: cleaned.slice(0, 3000),
      location: '',
    };
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await request.json().catch(() => ({}));
  if (!url || !url.startsWith('http')) {
    return NextResponse.json({ error: 'Valid URL required' }, { status: 400 });
  }

  try {
    // Check if we already have this URL
    const existing = await prisma.job.findFirst({
      where: { userId: user.id, url },
      include: { jobScores: { where: { userId: user.id } } },
    });

    let job = existing;

    if (!job) {
      // Fetch and extract job content
      const content = await fetchJobContent(url);

      const dedupeKey = crypto
        .createHash('md5')
        .update(content.company.toLowerCase() + '|' + content.title.toLowerCase() + '|' + (content.location || 'remote').toLowerCase())
        .digest('hex');

      // Create the job record
      const scrapeRun = await prisma.scrapeRun.create({
        data: { userId: user.id, source: 'url_paste', status: 'complete', startedAt: new Date(), completedAt: new Date(), jobsNew: 1, jobsFound: 1 },
      });

      job = await prisma.job.create({
        data: {
          userId: user.id,
          title: content.title,
          company: content.company,
          description: content.description,
          requirements: '',
          location: content.location,
          url,
          applyUrl: url,
          source: 'url_paste',
          atsType: detectATS(url),
          dedupeKey,
          isActive: true,
          isRemote: /remote/i.test(content.location + ' ' + content.description),
          isHybrid: /hybrid/i.test(content.location + ' ' + content.description),
          jobType: /remote/i.test(content.location) ? 'remote' : 'onsite',
          lastScrapedAt: new Date(),
          scrapeRunId: scrapeRun.id,
          roleFamilies: [],
        },
        include: { jobScores: { where: { userId: user.id } } },
      });
    }

    // Run evaluation immediately
    const { generateJobEvaluation } = await import('@/lib/job-evaluator');
    const evaluation = await generateJobEvaluation(job.id, user.id);

    // Score the job
    const { scoreJob } = await import('@/lib/job-scorer');
    const [profile, skills, jobPrefs, workHistory] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: user.id } }),
      prisma.skill.findMany({ where: { userId: user.id } }),
      prisma.jobPreferences.findUnique({ where: { userId: user.id } }),
      prisma.workHistory.findMany({ where: { userId: user.id }, orderBy: { startDate: 'desc' } }),
    ]);

    if (!existing?.jobScores?.length) {
      let yearsExp = 0;
      const earliest = workHistory[workHistory.length - 1]?.startDate;
      if (earliest) yearsExp = Math.floor((Date.now() - new Date(earliest).getTime()) / (1000 * 60 * 60 * 24 * 365));

      const scoringProfile = {
        skills: [...new Set([...(profile?.skills || []), ...skills.map(s => s.name)])],
        roles: [...new Set([...(profile?.roles || []), ...(jobPrefs?.targetTitles || [])])],
        industries: [...new Set([...(profile?.industries || []), ...(jobPrefs?.targetIndustries || [])])],
        yearsExperience: yearsExp || profile?.yearsExperience || 0,
        education: profile?.education || [],
        technologies: [...new Set([...(profile?.technologies || []), ...workHistory.flatMap(w => w.technologies || [])])],
        targetTitles: [...(jobPrefs?.targetTitles || []), ...(profile?.jobTitle ? [profile.jobTitle] : [])],
        targetIndustries: jobPrefs?.targetIndustries || [],
        roleFamilies: jobPrefs?.roleFamilies || [],
        salaryMin: jobPrefs?.salaryMinUSD || undefined,
        salaryMax: jobPrefs?.salaryMaxUSD || undefined,
        remotePreference: jobPrefs?.remotePreference || undefined,
        preferredLocations: jobPrefs?.preferredLocations || [],
      };

      const scoreResult = scoreJob(scoringProfile, {
        title: job.title, description: job.description, requirements: job.requirements || '',
        isRemote: job.isRemote || false, isHybrid: job.isHybrid || false,
        location: job.location || undefined, roleFamilies: job.roleFamilies || [],
        atsType: job.atsType || undefined,
      });

      await prisma.jobScore.create({
        data: {
          userId: user.id, jobId: job.id,
          score: scoreResult.score, overallScore: scoreResult.overallScore,
          reasoning: scoreResult.reasoning, recommendation: scoreResult.recommendation,
          skillScore: scoreResult.skillScore, roleScore: scoreResult.roleScore,
          locationScore: scoreResult.locationScore, compensationScore: scoreResult.compensationScore,
        },
      });
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      job: {
        title: job.title,
        company: job.company,
        location: job.location,
        atsType: job.atsType,
        url: job.url,
      },
      evaluation,
      alreadyExisted: !!existing,
    });

  } catch (err) {
    console.error('[evaluate-url] Error:', err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Failed to evaluate URL',
    }, { status: 500 });
  }
}
