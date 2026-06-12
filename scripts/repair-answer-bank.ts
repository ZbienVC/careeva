/**
 * scripts/repair-answer-bank.ts — one-time repair of poisoned answer-bank keys.
 *
 * Before 2026-06-12 the review editor saved answers keyed off question labels
 * that still carried the worker's diagnostic suffix ("Do you identify as a
 * Person of Colour?* (dropdown interaction failed)"), so the stored
 * questionKey ("...colour_dropdown_int") never matches the form field's clean
 * slug ("...colour_") on refill. Those answers silently never apply.
 *
 * This script finds every ReusableAnswer whose questionText carries a
 * diagnostic suffix, recomputes the clean key, and re-keys the row. If a
 * clean-keyed row already exists, the most recently updated answer wins and
 * the poisoned row is deleted either way.
 *
 * Usage (needs DATABASE_URL, e.g. via Railway):
 *   npx tsx scripts/repair-answer-bank.ts            # dry run — prints the plan
 *   npx tsx scripts/repair-answer-bank.ts --apply    # actually writes
 */
import { PrismaClient } from '@prisma/client';
import { stripDiagnostics, slugifyQuestion, DIAGNOSTIC_SUFFIX_RE } from '../lib/answer-key';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const rows = await prisma.reusableAnswer.findMany({
    where: { questionText: { contains: '(' } },
    orderBy: { updatedAt: 'asc' },
  });
  const poisoned = rows.filter((r) => r.questionText && DIAGNOSTIC_SUFFIX_RE.test(r.questionText));
  console.log(`${rows.length} candidate rows, ${poisoned.length} with diagnostic suffixes${APPLY ? '' : ' (DRY RUN — pass --apply to write)'}\n`);

  for (const row of poisoned) {
    const cleanText = stripDiagnostics(row.questionText!);
    const cleanKey = slugifyQuestion(cleanText);
    console.log(`row ${row.id} (user ${row.userId})`);
    console.log(`  text : ${JSON.stringify(row.questionText)} -> ${JSON.stringify(cleanText)}`);
    console.log(`  key  : ${row.questionKey} -> ${cleanKey}`);
    console.log(`  answer: ${JSON.stringify(row.answer.slice(0, 80))}`);

    if (cleanKey === row.questionKey) {
      console.log('  action: key already clean — fix questionText only');
      if (APPLY) {
        await prisma.reusableAnswer.update({ where: { id: row.id }, data: { questionText: cleanText } });
      }
      continue;
    }

    const existing = await prisma.reusableAnswer.findUnique({
      where: { userId_questionKey: { userId: row.userId, questionKey: cleanKey } },
    });
    if (!existing) {
      console.log('  action: re-key row to clean key');
      if (APPLY) {
        await prisma.reusableAnswer.update({
          where: { id: row.id },
          data: { questionKey: cleanKey, questionText: cleanText },
        });
      }
    } else if (existing.updatedAt < row.updatedAt) {
      console.log(`  action: clean row exists but is older — adopt this answer (was ${JSON.stringify(existing.answer.slice(0, 80))}), delete poisoned row`);
      if (APPLY) {
        await prisma.reusableAnswer.update({
          where: { id: existing.id },
          data: { answer: row.answer, isVerified: row.isVerified || existing.isVerified, questionText: cleanText },
        });
        await prisma.reusableAnswer.delete({ where: { id: row.id } });
      }
    } else {
      console.log('  action: newer clean row already exists — delete poisoned row');
      if (APPLY) {
        await prisma.reusableAnswer.delete({ where: { id: row.id } });
      }
    }
  }

  console.log(`\n${poisoned.length} rows ${APPLY ? 'repaired' : 'would be repaired'}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
