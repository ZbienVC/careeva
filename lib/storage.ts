/**
 * lib/storage.ts
 *
 * File storage adapter. Backend: Postgres (file_blobs table) — the web app
 * and the apply worker share files through the database they already share,
 * since Railway volumes can only attach to a single service.
 *
 * All callers use save/get/delete/exists with opaque keys, never raw paths,
 * so a future R2/S3 driver remains a drop-in swap.
 */

import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/** DB-backed storage persists across deploys by definition. */
export function isPersistent(): boolean {
  return true;
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
  await prisma.fileBlob.create({ data: { key, data: new Uint8Array(data), size: data.length } });
  return { key, size: data.length, originalName };
}

/** Read a file by key. Throws if missing. */
export async function getFile(key: string): Promise<Buffer> {
  const blob = await prisma.fileBlob.findUnique({ where: { key } });
  if (!blob) throw new Error(`File not found: ${key}`);
  return Buffer.from(blob.data);
}

export async function fileExists(key: string): Promise<boolean> {
  const blob = await prisma.fileBlob.findUnique({ where: { key }, select: { key: true } });
  return !!blob;
}

export async function deleteFile(key: string): Promise<void> {
  // Deleting a missing file is not an error.
  await prisma.fileBlob.deleteMany({ where: { key } });
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
