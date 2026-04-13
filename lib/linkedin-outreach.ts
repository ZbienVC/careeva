/**
 * lib/linkedin-outreach.ts
 *
 * Generate personalized LinkedIn connection messages (≤300 chars).
 * 4 contact types: recruiter, hiring_manager, peer, interviewer.
 */

import { prisma } from '@/lib/db';
import { generate } from '@/lib/ai-client';

export type ContactType = 'recruiter' | 'hiring_manager' | 'peer' | 'interviewer';

const FRAMEWORKS: Record<ContactType, string> = {
  recruiter: `3-sentence framework:
1. Fit: direct match criteria — role, key experience, availability/location
2. Proof: one data point that pre-answers their screening questions
3. CTA: "Happy to share my CV if this aligns with what you're looking for"`,

  hiring_manager: `3-sentence framework:
1. Hook: a specific challenge their team likely faces (from the JD or company context)
2. Proof: the candidate's single most quantifiable achievement relevant to that challenge
3. CTA: "Would love to hear how your team is approaching [specific challenge]"`,

  peer: `3-sentence framework:
1. Genuine interest: reference something specific about their work (project, article, talk)
2. Connection: what the candidate is working on in the same space (NOT a job pitch)
3. CTA: "Would love to hear your take on [specific topic]"
CRITICAL: Do NOT ask for a job referral — let the conversation develop naturally.`,

  interviewer: `3-sentence framework:
1. Research signal: reference something specific about their background or work
2. Light context: a brief connection to the candidate's experience in that area
3. CTA: "Looking forward to our conversation on [date/topic]"
Keep it light — the goal is to show preparation, not to impress.`,
};

export async function generateLinkedInOutreach(
  jobId: string,
  userId: string,
  contactType: ContactType,
  contactName?: string
): Promise<string> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Job ${jobId} not found`);

  const [profile, workHistory, skills] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.workHistory.findMany({ where: { userId }, orderBy: { startDate: 'desc' }, take: 3 }),
    prisma.skill.findMany({ where: { userId }, take: 10 }),
  ]);

  const profileSummary = [
    profile?.jobTitle ? `My role: ${profile.jobTitle}` : null,
    workHistory[0] ? `Currently/Recently: ${workHistory[0].title} at ${workHistory[0].company}` : null,
    skills.length > 0 ? `Key skills: ${skills.map((s: any) => s.name).slice(0, 5).join(', ')}` : null,
  ].filter(Boolean).join('\n');

  const message = await generate({
    task: 'answer_short',
    maxTokens: 200,
    systemPrompt: `You write LinkedIn connection request messages. Rules:
- Maximum 300 characters total (LinkedIn's limit)
- No corporate speak, no "I'm passionate about..."
- Must feel like a real human wrote it
- Direct, specific, worth responding to
- NEVER include a phone number
Respond with ONLY the message text, nothing else.`,
    prompt: `Write a LinkedIn connection request message.

Contact type: ${contactType}
Contact name: ${contactName || 'the contact'}
Company: ${job.company}
Role being applied to: ${job.title}

Framework to follow:
${FRAMEWORKS[contactType]}

Candidate profile:
${profileSummary}

Write a message of maximum 300 characters. Be specific and human.`,
  });

  // Enforce 300 char limit
  return message.trim().slice(0, 300);
}
