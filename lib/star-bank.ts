/**
 * lib/star-bank.ts
 *
 * STAR+R story bank — accumulates interview stories across job evaluations.
 */

import { prisma } from '@/lib/db';
import type { StarStoryData } from '@/lib/job-evaluator';

export async function addStories(
  userId: string,
  stories: StarStoryData[],
  jobId?: string
): Promise<void> {
  if (stories.length === 0) return;

  await prisma.starStory.createMany({
    data: stories.map((s) => ({
      userId,
      jobId: jobId ?? null,
      requirement: s.requirement,
      situation: s.situation,
      task: s.task,
      action: s.action,
      result: s.result,
      reflection: s.reflection,
      tags: s.tags,
    })),
    skipDuplicates: false,
  });
}

export async function getStories(userId: string) {
  return prisma.starStory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findRelevantStories(userId: string, requirement: string) {
  const allStories = await prisma.starStory.findMany({ where: { userId } });

  const keywords = requirement.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  return allStories
    .map((story) => {
      const text = [story.requirement, story.tags.join(' '), story.situation, story.task]
        .join(' ')
        .toLowerCase();
      const score = keywords.filter((kw) => text.includes(kw)).length;
      return { story, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ story }) => story);
}
