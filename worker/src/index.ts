/**
 * worker/src/index.ts — Careeva apply worker
 *
 * Long-running service. Polls the Postgres apply_tasks queue, drives a
 * Playwright Chromium instance through ATS application forms, and writes
 * status + screenshots back for the dashboard.
 *
 * Lifecycle per task:
 *   queued -> claimed -> filling -> (per mode)
 *     approve_first : awaiting_approval -> [user approves via API] -> approved
 *                     -> submitting -> submitted
 *     fill_and_leave: needs_review (form left filled; user finishes manually —
 *                     note: page state can't persist, so this mode saves the
 *                     screenshot + field report and links the user to the form)
 *     full_auto     : submitting -> submitted
 *   Any unanswerable REQUIRED question (config 'pause') or error -> needs_review/failed.
 *
 * Env (set on the worker Railway service):
 *   DATABASE_URL                — same Postgres as the web app
 *   RAILWAY_VOLUME_MOUNT_PATH   — same volume as the web app (resumes + screenshots)
 *   STORAGE_DIR                 — optional override, must match web app
 *   WORKER_POLL_MS              — queue poll interval (default 5000)
 *   HEADLESS                    — "false" to watch locally (default true)
 */

import { PrismaClient } from '@prisma/client';
import { chromium, Browser } from 'playwright';
import crypto from 'crypto';
import fs from 'fs';
import { getAdapterFor } from './adapters';
import { storagePathFor, saveScreenshot } from './storage';

const prisma = new PrismaClient({ log: ['error'] });
const WORKER_ID = `worker-${crypto.randomBytes(4).toString('hex')}`;
const POLL_MS = parseInt(process.env.WORKER_POLL_MS || '5000', 10);
const HEADLESS = process.env.HEADLESS !== 'false';

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  return browser;
}

function randDelayMs(min: number, max: number): number {
  return (min + Math.random() * Math.max(0, max - min)) * 1000;
}

/** Atomically claim the oldest runnable task (queued, or approved-for-submit). */
async function claimTask() {
  // Postgres-native atomic claim: UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED)
  const rows: Array<{ id: string }> = await prisma.$queryRaw`
    UPDATE "apply_tasks" SET
      "status" = CASE WHEN "status" = 'queued' THEN 'claimed' ELSE 'submitting' END,
      "claimedBy" = ${WORKER_ID},
      "claimedAt" = NOW(),
      "attempts" = "attempts" + 1,
      "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id" FROM "apply_tasks"
      WHERE "status" IN ('queued', 'approved') AND "attempts" < 3
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING "id"
  `;
  if (!rows.length) return null;
  return prisma.applyTask.findUnique({ where: { id: rows[0].id } });
}

async function setStatus(taskId: string, status: string, extra: Record<string, unknown> = {}) {
  await prisma.applyTask.update({ where: { id: taskId }, data: { status, ...extra } });
}

async function processTask(task: NonNullable<Awaited<ReturnType<typeof claimTask>>>) {
  const log = (m: string) => console.log(`[${WORKER_ID}] task ${task.id}: ${m}`);
  const config = await prisma.autoApplyConfig.findUnique({ where: { userId: task.userId } });
  const minDelay = config?.minDelaySeconds ?? 30;
  const maxDelay = config?.maxDelaySeconds ?? 90;

  const adapter = getAdapterFor(task.atsType || '', task.applyUrl || '');
  if (!adapter) {
    await setStatus(task.id, 'needs_review', { lastError: `No adapter for ATS "${task.atsType}" — apply manually via the companion view.` });
    return;
  }

  const b = await getBrowser();
  const context = await b.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();

  try {
    const packet = (task.packet || {}) as Record<string, unknown>;
    const resumeKey = packet.resumeKey as string | undefined;
    const resumePath = resumeKey ? storagePathFor(resumeKey) : null;

    // Never submit an application with a silently-missing resume: if the packet
    // references a file the volume doesn't have (volume not mounted, stale key),
    // stop here with an actionable error instead of filing a resume-less app.
    if (resumePath && !fs.existsSync(resumePath)) {
      await setStatus(task.id, 'needs_review', {
        lastError: 'Resume file not found on the worker volume — confirm both services share the same volume/mount path, then re-upload your resume and retry.',
      });
      log(`resume file missing at ${resumePath}`);
      return;
    }

    // ── Resume submission for an already-approved task ──
    if (task.status === 'submitting' && task.approvedAt) {
      log(`re-filling + submitting (approved at ${task.approvedAt.toISOString()})`);
      const fill = await adapter.fill(page, task, { resumePath, config });
      if (!fill.ok) {
        await setStatus(task.id, 'needs_review', { lastError: fill.error || 'Re-fill before submit failed', fieldReport: fill.report as object });
        return;
      }
      const sub = await adapter.submit(page, task);
      if (sub.ok) {
        await setStatus(task.id, 'submitted', { submittedAt: new Date(), externalId: sub.externalId || null, fieldReport: fill.report as object });
        if (task.applicationId) {
          await prisma.application.update({
            where: { id: task.applicationId },
            data: { status: 'applied', appliedAt: new Date(), externalApplicationId: sub.externalId || undefined },
          }).catch(() => {});
        }
        log('SUBMITTED');
      } else {
        await setStatus(task.id, 'needs_review', { lastError: sub.error || 'Submit failed' });
      }
      return;
    }

    // ── Fresh task: fill the form ──
    await setStatus(task.id, 'filling');
    log(`filling ${task.applyUrl} via ${adapter.name}`);
    const fill = await adapter.fill(page, task, { resumePath, config });

    // Screenshot the final form state regardless of outcome (review evidence)
    const shotKey = await saveScreenshot(page, task.userId, task.id);

    if (!fill.ok) {
      await setStatus(task.id, 'needs_review', {
        lastError: fill.error || 'Fill incomplete',
        screenshotKey: shotKey,
        fieldReport: fill.report as object,
      });
      log(`needs review: ${fill.error}`);
      return;
    }

    const mode = task.mode || config?.submitMode || 'approve_first';

    if (mode === 'fill_and_leave') {
      await setStatus(task.id, 'needs_review', {
        screenshotKey: shotKey,
        fieldReport: fill.report as object,
        lastError: null,
      });
      log('filled — left for manual finish (fill_and_leave)');
      return;
    }

    if (mode === 'approve_first') {
      await setStatus(task.id, 'awaiting_approval', {
        screenshotKey: shotKey,
        fieldReport: fill.report as object,
      });
      log('awaiting user approval');
      return;
    }

    // full_auto: unattended submission must EARN it (product trust gates):
    //   1) Perfect fill only — zero AI-guessed answers, zero unanswered
    //      required questions, resume actually attached.
    //   2) Track record — the user's first 10 submissions are always
    //      human-approved; full-auto unlocks after that.
    const report = fill.report as { guessed?: string[]; unanswered?: string[]; resumeAttached?: boolean } | undefined;
    const imperfectFill =
      (report?.guessed?.length || 0) > 0 ||
      (report?.unanswered?.length || 0) > 0 ||
      report?.resumeAttached === false;
    const approvedSubmissions = await prisma.applyTask.count({
      where: { userId: task.userId, status: 'submitted', approvedAt: { not: null } },
    });
    if (imperfectFill || approvedSubmissions < 10) {
      await setStatus(task.id, 'awaiting_approval', {
        screenshotKey: shotKey,
        fieldReport: fill.report as object,
      });
      log(imperfectFill
        ? 'full_auto downgraded to approval: fill is not perfect (guessed/unanswered/no resume)'
        : `full_auto downgraded to approval: trust ramp (${approvedSubmissions}/10 approved submissions)`);
      return;
    }

    // Human-ish pause, then submit
    await new Promise((r) => setTimeout(r, randDelayMs(2, 6)));
    await setStatus(task.id, 'submitting', { screenshotKey: shotKey, fieldReport: fill.report as object });
    const sub = await adapter.submit(page, task);
    if (sub.ok) {
      await setStatus(task.id, 'submitted', { submittedAt: new Date(), externalId: sub.externalId || null });
      if (task.applicationId) {
        await prisma.application.update({
          where: { id: task.applicationId },
          data: { status: 'applied', appliedAt: new Date(), externalApplicationId: sub.externalId || undefined },
        }).catch(() => {});
      }
      log('SUBMITTED (full_auto)');
    } else {
      await setStatus(task.id, 'needs_review', { lastError: sub.error || 'Submit failed' });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${WORKER_ID}] task ${task.id} error:`, msg);
    const finalFailure = task.attempts >= 3;
    await setStatus(task.id, finalFailure ? 'failed' : 'queued', { lastError: msg, claimedBy: null });
    // Don't leave the tracker stuck in 'prepping' forever on a permanent failure —
    // park the application back in 'saved' with the error so the user can act.
    if (finalFailure && task.applicationId) {
      await prisma.application.updateMany({
        where: { id: task.applicationId, status: 'prepping' },
        data: { status: 'saved', notes: `Auto-apply failed after 3 attempts: ${msg.slice(0, 400)}` },
      }).catch((e: unknown) => console.error(`[${WORKER_ID}] tracker sync failed:`, e));
    }
  } finally {
    await context.close().catch(() => {});
    // Randomized inter-application delay (Q16: human-ish pacing)
    await new Promise((r) => setTimeout(r, randDelayMs(minDelay, maxDelay)));
  }
}

/** Recover tasks stuck in transient states from a crashed worker (>15 min old). */
async function recoverStuckTasks() {
  await prisma.applyTask.updateMany({
    where: { status: { in: ['claimed', 'filling', 'submitting'] }, claimedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
    data: { status: 'queued', claimedBy: null },
  }).catch(() => {});
}

async function main() {
  console.log(`[${WORKER_ID}] Careeva apply worker starting (poll ${POLL_MS}ms, headless=${HEADLESS})`);
  await recoverStuckTasks();
  let lastRecovery = Date.now();

  for (;;) {
    try {
      // Periodic (not just boot-time) recovery, so a crash mid-run can't
      // strand tasks until the next deploy.
      if (Date.now() - lastRecovery > 5 * 60 * 1000) {
        await recoverStuckTasks();
        lastRecovery = Date.now();
      }
      const task = await claimTask();
      if (task) {
        await processTask(task);
      } else {
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    } catch (err) {
      console.error(`[${WORKER_ID}] loop error:`, err);
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
