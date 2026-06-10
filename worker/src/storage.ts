/**
 * worker/src/storage.ts — same volume layout as the web app's lib/storage.ts.
 * The worker reads resume files by key and writes screenshots the dashboard serves.
 */
import fs from 'fs';
import path from 'path';
import type { Page } from 'playwright';

function baseDir(): string {
  const dir =
    process.env.STORAGE_DIR ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    path.join(process.cwd(), '..', 'storage');
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function storagePathFor(key: string): string {
  const base = baseDir();
  const p = path.resolve(base, key);
  if (!p.startsWith(base + path.sep)) throw new Error('Invalid storage key');
  return p;
}

export async function saveScreenshot(page: Page, userId: string, taskId: string): Promise<string> {
  const key = path.posix.join('screenshots', userId, `${taskId}-${Date.now()}.png`);
  const full = storagePathFor(key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  await page.screenshot({ path: full, fullPage: true });
  return key;
}
