/**
 * lib/db.ts
 *
 * Back-compat re-export. The canonical Prisma client lives in lib/prisma.ts.
 * Kept so existing `import { prisma } from '@/lib/db'` sites keep working while
 * we converge on a single client instance.
 */
export { prisma } from './prisma';
