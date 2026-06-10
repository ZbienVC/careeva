/**
 * lib/storage.ts
 *
 * File storage adapter. Backend: local disk on a Railway Volume (persistent
 * across deploys). Designed so a future R2/S3 driver is a drop-in swap — all
 * callers use save/get/delete/exists with opaque keys, never raw paths.
 *
 * Configuration:
 *   STORAGE_DIR                 explicit base dir (highest priority)
 *   RAILWAY_VOLUME_MOUNT_PATH   set automatically by Railway when a Volume is
 *                               attached to the service — used if present
 *   fallback                    <cwd>/storage  (ephemeral; dev only)
 *
 * On Railway: attach a Volume to the careeva service (e.g. mount path /data).
 * No further config needed — RAILWAY_VOLUME_MOUNT_PATH is picked up.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function baseDir(): string {
  const dir =
    process.env.STORAGE_DIR ||
    process.env.RAILWAY_VOLUME_MOUNT_PATH ||
    path.join(process.cwd(), 'storage');
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

/** True if files will persist across deploys (a volume/explicit dir is configured). */
export function isPersistent(): boolean {
  return !!(process.env.STORAGE_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH);
}

function safeName(original: string): string {
  // Keep extension, strip path tricks and odd characters from the stem.
  const ext = path.extname(original).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
  const stem = path
    .basename(original, path.extname(original))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
  return `${stem}${ext}`;
}

/** Resolve a key to an absolute path, refusing anything that escapes the base dir. */
function keyToPath(key: string): string {
  const base = baseDir();
  const p = path.resolve(base, key);
  if (!p.startsWith(base + path.sep) && p !== base) {
    throw new Error('Invalid storage key');
  }
  return p;
}

export interface SavedFile {
  key: string;        // opaque storage key, e.g. "resumes/<userId>/<id>-file.pdf"
  size: number;
  originalName: string;
}

/** Save a buffer under a namespaced key. Returns the key to persist in the DB. */
export async function saveFile(
  namespace: string,           // e.g. `resumes/${userId}`
  originalName: string,
  data: Buffer
): Promise<SavedFile> {
  const ns = namespace.replace(/[^a-zA-Z0-9/_-]/g, '_');
  const id = crypto.randomBytes(8).toString('hex');
  const key = path.posix.join(ns, `${id}-${safeName(originalName)}`);
  const fullPath = keyToPath(key);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, data);
  return { key, size: data.length, originalName };
}

/** Read a file by key. Throws if missing. */
export async function getFile(key: string): Promise<Buffer> {
  return fs.readFileSync(keyToPath(key));
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    return fs.existsSync(keyToPath(key));
  } catch {
    return false;
  }
}

export async function deleteFile(key: string): Promise<void> {
  try {
    const p = keyToPath(key);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // Deleting a missing file is not an error.
  }
}

/** Content-Type for download responses, by file extension. */
export function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.txt': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return map[ext] || 'application/octet-stream';
}
