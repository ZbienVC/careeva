/**
 * lib/apply-queue.ts — web-app side of the apply engine.
 *
 * enqueueApplyTask: builds the full application packet (cover letter, answers,
 * identity, resume file key), applies the duplicate policy (Q15), resolves
 * LinkedIn "apply on company website" redirects to their real ATS (Q5), and
 * writes the ApplyTask the worker will pick up.
 */
import { prisma } from '@/lib/prisma';
import { buildApplicationPacket } from '@/lib/auto-apply';
import { isAggregatorUrl } from '@/lib/job-search';

// ── LinkedIn redirect resolution (Q5: zero-bot LinkedIn strategy) ─────────────
// Many LinkedIn postings are "Apply on company website" — follow the redirect
// chain (no login, just HTTP) to land on the real ATS where adapters work.
export async function resolveApplyUrl(rawUrl: string): Promise<{ url: string; atsType?: string }> {
  let url = rawUrl;
  try {
    if (/linkedin\.com\/jobs/i.test(url)) {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Careeva/1.0)' },
        signal: AbortSignal.timeout(10000),
      });
      // externalApply link sometimes present in the page HTML
      const html = await res.text();
      const m = html.match(/"applyUrl"\s*:\s*"([^"]+)"/) || html.match(/externalApply[^"]*"url":"([^"]+)"/);
      if (m?.[1]) url = decodeURIComponent(m[1].replace(/\\u002[fF]/g, '/'));
    } else {
      // Generic shorteners/redirectors (Adzuna redirect_url, etc.). Some hosts
      // reject HEAD — fall back to GET and just follow the redirect chain.
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (!res?.ok) {
        res = await fetch(url, {
          method: 'GET',
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Careeva/1.0)' },
          signal: AbortSignal.timeout(10000),
        }).catch(() => null);
      }
      if (res?.url) url = res.url;

      // If we still landed on an aggregator listing, scan its HTML for a
      // direct ATS link — many listings embed the real application URL.
      if (res && isAggregatorUrl(url)) {
        const html = await res.text().catch(() => '');
        const atsLink = html.match(
          /https?:\/\/[^"'\s<>]*(?:greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|icims\.com|jobvite\.com|workable\.com|recruitee\.com|breezy\.hr|bamboohr\.com|teamtailor\.com)[^"'\s<>]*/i
        );
        if (atsLink?.[0]) url = atsLink[0].replace(/&amp;/g, '&');
      }
    }
  } catch { /* keep original */ }

  const atsType =
    /greenhouse\.io/.test(url) ? 'greenhouse' :
    /lever\.co/.test(url) ? 'lever' :
    /ashbyhq\.com/.test(url) ? 'ashby' :
    /myworkdayjobs|workday\.com/.test(url) ? 'workday' :
    /smartrecruiters\.com/.test(url) ? 'smartrecruiters' :
    /icims\.com/.test(url) ? 'icims' :
    /taleo\.net/.test(url) ? 'taleo' :
    /successfactors|sapsf/.test(url) ? 'successfactors' :
    undefined;
  return { url, atsType };
}

export interface EnqueueResult {
  taskId?: string;
  status: string;
  duplicate?: boolean;
  duplicateInfo?: { company: string; role: string; appliedAt: Date | null };
  blocked?: string;
}

export async function enqueueApplyTask(
  userId: string,
  jobId: string,
  modeOverride?: string
): Promise<EnqueueResult> {
  const job = await prisma.job.findFirst({ where: { id: jobId, userId } });
  if (!job) throw new Error('Job not found');

  const config = await prisma.autoApplyConfig.findUnique({ where: { userId } });

  // ── User-configured filters: blacklists/whitelist are hard gates ──
  const companyLow = job.company.toLowerCase();
  const titleLow = job.title.toLowerCase();
  if (config?.companyBlacklist?.some((c) => c && companyLow.includes(c.toLowerCase()))) {
    return { status: 'blocked_company_blacklist', blocked: `${job.company} is on your company blacklist (Settings → Auto-apply).` };
  }
  if (config?.titleBlacklist?.some((t) => t && titleLow.includes(t.toLowerCase()))) {
    return { status: 'blocked_title_blacklist', blocked: `"${job.title}" matches your title blacklist (Settings → Auto-apply).` };
  }
  if (config?.titleWhitelist?.length && !config.titleWhitelist.some((t) => t && titleLow.includes(t.toLowerCase()))) {
    return { status: 'blocked_title_whitelist', blocked: `"${job.title}" doesn't match your title whitelist (Settings → Auto-apply).` };
  }

  // ── Daily application cap ──
  if (config?.maxApplicationsPerDay) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.applyTask.count({
      where: { userId, createdAt: { gte: dayStart }, status: { notIn: ['cancelled', 'failed'] } },
    });
    if (todayCount >= config.maxApplicationsPerDay) {
      return { status: 'blocked_daily_limit', blocked: `Daily limit reached (${config.maxApplicationsPerDay} applications/day — raise it in Settings → Auto-apply).` };
    }
  }

  // Re-clicking the same job returns the in-flight task instead of tripping
  // the company-duplicate gate on its own application row.
  const existingTask = await prisma.applyTask.findFirst({
    where: { userId, jobId, status: { in: ['queued', 'claimed', 'filling', 'awaiting_approval', 'approved', 'submitting'] } },
  });
  if (existingTask) {
    return { taskId: existingTask.id, status: existingTask.status, duplicate: true };
  }

  // Same EXACT job already applied to (e.g. via Quick Apply)? Submitting a
  // second application to the identical posting is never useful.
  const sameJobApplied = await prisma.application.findFirst({
    where: { userId, jobId, status: { in: ['applied', 'phone_screen', 'interview', 'offer', 'rejected'] } },
    select: { status: true, appliedAt: true },
  });
  if (sameJobApplied) {
    return {
      status: 'blocked_already_applied',
      duplicate: true,
      blocked: `You already applied to this exact role${sameJobApplied.appliedAt ? ` on ${sameJobApplied.appliedAt.toLocaleDateString()}` : ''} — it's in your Tracker.`,
    };
  }

  // ── Q15 duplicate policy (same COMPANY, different role — this job's own
  // prior rows don't count, they're handled above/with retry) ──
  const prior = await prisma.application.findFirst({
    where: { userId, company: job.company, status: { notIn: ['withdrawn', 'cancelled'] }, NOT: { jobId } },
    orderBy: { createdAt: 'desc' },
    select: { company: true, role: true, appliedAt: true },
  });
  if (prior) {
    if (!config?.allowSameCompanyRoles) {
      return {
        status: 'blocked_duplicate',
        duplicate: true,
        duplicateInfo: prior,
        blocked: `Already applied to ${prior.company} (${prior.role}). Enable "different roles at same company" in settings to allow.`,
      };
    }
    // Allowed, but the duplicate notice is surfaced to the caller (Q15-B)
  }

  // ── Build the packet (cover letter + answers, real data only) ──
  const packet = await buildApplicationPacket(userId, jobId);

  // Identity for the worker (already guaranteed real by buildApplicationPacket gates)
  const personalInfo = await prisma.personalInfo.findUnique({ where: { userId } });
  if (!personalInfo?.fullName || !personalInfo?.email) {
    return { status: 'blocked_incomplete_profile', blocked: 'Complete name + email in your profile first (see Profile → completeness).' };
  }
  const nameParts = personalInfo.fullName.trim().split(/\s+/);

  // Resume file key (worker attaches the REAL file)
  const resume = await prisma.resume.findFirst({
    where: { userId, fileUrl: { startsWith: 'storage://' } },
    orderBy: [{ isBase: 'desc' }, { createdAt: 'desc' }],
  });
  if (!resume) {
    return { status: 'blocked_no_resume_file', blocked: 'No stored resume file. Upload your resume (file storage is now enabled).' };
  }

  // ── Resolve the real apply URL (LinkedIn → ATS, redirectors → final) ──
  // Try applyUrl first; if that resolves to an aggregator listing, also try
  // the job's source url — whichever lands on a fillable page wins.
  let { url: applyUrl, atsType } = await resolveApplyUrl(job.applyUrl || job.url || '');
  if (isAggregatorUrl(applyUrl) && job.url && job.url !== job.applyUrl) {
    const alt = await resolveApplyUrl(job.url);
    if (!isAggregatorUrl(alt.url)) {
      applyUrl = alt.url;
      atsType = alt.atsType;
    }
  }

  // An aggregator listing page (Google/LinkedIn/Indeed/...) has no form the
  // worker can fill — be honest about it instead of queuing a doomed task.
  if (!applyUrl || isAggregatorUrl(applyUrl)) {
    return {
      status: 'blocked_no_direct_form',
      blocked: `This listing only links to a job board page, not a fillable application form. Open the posting and use its "Apply on company site" link — or use Quick Apply to track it after applying manually.`,
    };
  }

  if (atsType && atsType !== job.atsType) {
    await prisma.job.update({ where: { id: job.id }, data: { applyUrl, atsType } }).catch(() => {});
  }

  // ── Application row (tracker) ──
  // 'prepping' is the valid tracker status while the worker fills/awaits
  // approval; the worker flips it to 'applied' on successful submission.
  // Reuse a parked row for this job (failed/withdrawn retry) instead of
  // stacking duplicates in the tracker.
  const parked = await prisma.application.findFirst({
    where: { userId, jobId, status: { in: ['saved', 'prepping', 'withdrawn'] } },
    select: { id: true },
  });
  const applicationData = {
    company: job.company, role: job.title,
    status: 'prepping', url: job.url, applyUrl,
    atsType: atsType || job.atsType, submittedVia: 'careeva-worker',
  };
  const application = parked
    ? await prisma.application.update({ where: { id: parked.id }, data: applicationData })
    : await prisma.application.create({ data: { userId, jobId, ...applicationData } });

  const mode = modeOverride || config?.submitMode || 'approve_first';

  const task = await prisma.applyTask.create({
    data: {
      userId, jobId, applicationId: application.id,
      status: 'queued', mode,
      atsType: atsType || job.atsType, applyUrl,
      packet: {
        answers: packet.answers,
        coverLetter: config?.attachCoverLetter === false ? undefined : packet.coverLetter,
        resumeKey: resume.fileUrl!.slice('storage://'.length),
        identity: {
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(' '),
          fullName: personalInfo.fullName,
          email: personalInfo.email,
          phone: personalInfo.phone || undefined,
          linkedinUrl: personalInfo.linkedinUrl || undefined,
          githubUrl: personalInfo.githubUrl || undefined,
          portfolioUrl: personalInfo.portfolioUrl || undefined,
          location: [personalInfo.city, personalInfo.state].filter(Boolean).join(', ') || undefined,
        },
        qualityScore: packet.qualityScore,
        archetype: packet.archetype,
      },
    },
  });

  return {
    taskId: task.id,
    status: 'queued',
    ...(prior ? { duplicate: true, duplicateInfo: prior } : {}),
  };
}
