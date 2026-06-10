/**
 * worker/src/storage.ts — Postgres-backed file access, mirroring the web
 * app's lib/storage.ts. Files live in the shared file_blobs table; the worker
 * materializes resumes to a temp path for Playwright's setInputFiles, and
 * saves screenshots back as blobs the dashboard serves.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import type { PrismaClient } from '@prisma/client';
import type { Page } from 'playwright';

/**
 * Fetch a stored file and write it to a local temp path Playwright can use.
 * Returns null when the blob doesn't exist (caller surfaces a clear error).
 */
export async function materializeFile(prisma: PrismaClient, key: string): Promise<string | null> {
  const blob = await prisma.fileBlob.findUnique({ where: { key } });
  if (!blob) return null;
  const dir = path.join(os.tmpdir(), 'careeva-worker');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${crypto.randomBytes(6).toString('hex')}-${path.basename(key)}`);
  fs.writeFileSync(filePath, Buffer.from(blob.data));
  return filePath;
}

export async function saveScreenshot(prisma: PrismaClient, page: Page, userId: string, taskId: string): Promise<string> {
  const key = path.posix.join('screenshots', userId, `${taskId}-${Date.now()}.png`);
  const data = await page.screenshot({ fullPage: true });
  await prisma.fileBlob.create({ data: { key, data: new Uint8Array(data), size: data.length } });
  return key;
}
