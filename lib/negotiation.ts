/**
 * lib/negotiation.ts
 *
 * Salary negotiation script generator for 3 scenarios.
 */

import { generate } from '@/lib/ai-client';

export type NegotiationScenario = 'initial' | 'geographic' | 'competing';

export interface NegotiationContext {
  currentOffer: number;
  targetComp: number;
  role: string;
  company: string;
  competingOffer?: number;
  location?: string;
  currency?: string;
}

const SCENARIO_PROMPTS: Record<NegotiationScenario, (ctx: NegotiationContext) => string> = {
  initial: (ctx) => `Write a salary negotiation script for an initial offer.

Context:
- Role: ${ctx.role} at ${ctx.company}
- Offer received: ${ctx.currency || '$'}${ctx.currentOffer.toLocaleString()}
- Target: ${ctx.currency || '$'}${ctx.targetComp.toLocaleString()}
- Gap to close: ${ctx.currency || '$'}${(ctx.targetComp - ctx.currentOffer).toLocaleString()}

Write a professional but confident counter. Include:
1. A brief acknowledgment of the offer (not over-the-top grateful)
2. The counter number with market justification framing
3. A clear ask — specific number, not a range
4. A bridge that keeps the conversation open

Keep it under 200 words. Conversational tone. No groveling.`,

  geographic: (ctx) => `Write a negotiation script pushing back on a geographic pay discount.

Context:
- Role: ${ctx.role} at ${ctx.company}
- Offer received: ${ctx.currency || '$'}${ctx.currentOffer.toLocaleString()}
- Target: ${ctx.currency || '$'}${ctx.targetComp.toLocaleString()}
- Location: ${ctx.location || 'remote'}

The company appears to be discounting comp based on the candidate's location. Argue for:
1. Value delivered is location-independent
2. Remote talent market rates (not local cost of living)
3. Retention risk of below-market comp

Keep it under 180 words. Professional but assertive.`,

  competing: (ctx) => `Write a negotiation script leveraging a competing offer.

Context:
- Role: ${ctx.role} at ${ctx.company}
- Current offer: ${ctx.currency || '$'}${ctx.currentOffer.toLocaleString()}
- Competing offer: ${ctx.currency || '$'}${(ctx.competingOffer || ctx.targetComp).toLocaleString()}
- Target at ${ctx.company}: ${ctx.currency || '$'}${ctx.targetComp.toLocaleString()}

Write a script that:
1. Expresses genuine preference for this company (if true)
2. Mentions the competing offer factually, without ultimatum language
3. Asks directly if they can match or come close
4. Preserves the relationship regardless of outcome

Keep it under 180 words. Honest, not threatening.`,
};

export async function generateNegotiationScript(
  scenario: NegotiationScenario,
  context: NegotiationContext
): Promise<string> {
  return generate({
    task: 'answer_behavioral',
    maxTokens: 500,
    systemPrompt: `You are an expert salary negotiation coach. Write negotiation scripts that are:
- Direct and confident without being aggressive
- Specific with numbers and justifications
- Human and conversational, not corporate
- Focused on mutual value, not ultimatums
Respond with ONLY the script text, ready to send or say.`,
    prompt: SCENARIO_PROMPTS[scenario](context),
  });
}
