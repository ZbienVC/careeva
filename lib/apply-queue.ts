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
      // Generic shorteners/redirectors (Adzuna redirect_url, etc.)
      const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) }).catch(() => null);
      if (res?.url) url = res.url;
    }
  } catch { /* keep original */ }

  const atsType =
    /greenhouse\.io/.test(url) ? 'greenhouse' :
    /lever\.co/.test(url) ? 'lever' :
    /ashbyhq\.com/.test(url) ? 'ashby' :
    /myworkdayjobs|workday\.com/.test(url) ? 'workday' :
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

  // ── Q15 duplicate policy ──
  const prior = await prisma.application.findFirst({
    where: { userId, company: job.company, status: { notIn: ['withdrawn', 'cancelled'] } },
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

  // Don't double-enqueue the same job
  const existingTask = await prisma.applyTask.findFirst({
    where: { userId, jobId, status: { in: ['queued', 'claimed', 'filling', 'awaiting_approval', 'approved', 'submitting'] } },
  });
  if (existingTask) {
    return { taskId: existingTask.id, status: existingTask.status, duplicate: true };
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
  const { url: applyUrl, atsType } = await resolveApplyUrl(job.applyUrl || job.url || '');
  if (atsType && atsType !== job.atsType) {
    await prisma.job.update({ where: { id: job.id }, data: { applyUrl, atsType } }).catch(() => {});
  }

  // ── Application row (tracker) ──
  const application = await prisma.application.create({
    data: {
      userId, jobId,
      company: job.company, role: job.title,
      status: 'queued', url: job.url, applyUrl,
      atsType: atsType || job.atsType, submittedVia: 'careeva-worker',
    },
  });

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
