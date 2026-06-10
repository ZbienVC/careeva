# Product Decisions — 2026-06-10

Owner-defined direction (10-question session). Guiding principle: **minimize
recurring user time/thought after setup; maximize application volume AND
quality.** Setup can take as long as it needs; daily operation should take
near-zero effort.

## Decisions

| # | Area | Decision | Status |
|---|------|----------|--------|
| 1 | Daily flow | Fully automatic — scheduled runs find, score, and queue applications; user gets a summary | ✅ Built: cron auto-applies for users with the Settings master switch on; daily digest email |
| 2 | Auto-submit gate | Three conditions, ALL required: score ≥ 65 + perfect fill (zero AI guesses, zero unanswered, resume attached) + trust ramp (first 10 submissions human-approved) | ✅ Built: enforced in the worker's full_auto path |
| 3 | Notifications | Daily digest + instant on approval-needed + instant on confirmations; all togglable in Settings | 🟡 Digest built (needs SMTP env). Instant emails + per-channel toggles: next (needs schema field for prefs) |
| 4 | Volume | 25–50/week with solid tailoring on everything | ✅ Defaults support it (per-run/daily caps adjustable in Settings) |
| 5 | Tailoring depth | Strongest package — AI-tailored resume variant + custom letter + answers; adjustable in Settings (incl. "resume as-is") | 🟡 Letter + answers built; setting exists (`resumeVariant`). Per-job AI resume VARIANTS: next major feature |
| 6 | Letter style | Short & specific (~150 words), references one concrete company/role detail, no filler | ✅ Built: generation prompt rewritten |
| 7 | Unknown questions | AI best-guess + flag for review + learn the correction into the answer bank | ✅ Default now `ai_guess`; guesses flagged in field report; corrections via Edit-answers in Review feed the packet. Persisting corrections to ReusableAnswer bank: next |
| 8 | Follow-through | 7-day follow-up drafts + interview prep packs + (future) inbox auto-status | 🟡 Follow-up + interview-prep APIs exist; surface them automatically on a schedule: next. Inbox integration: future |
| 9 | Learning loop | Auto-tune targeting from which applications get responses | ⏳ Next: needs outcome data accumulating first (Tracker statuses) |
| 10 | Trust | Transparent audit trail (screenshot + answers + confirmation per application) + weekly scorecard + kill switch & caps | ✅ Audit trail + caps + master kill switch built. Weekly scorecard email: next |

## Next build queue (in priority order)
1. **Notification preferences** — schema field (`notificationPrefs` JSON on AutoApplyConfig), Settings toggles, instant approval-needed + confirmation emails.
2. **AI resume variants per job** — generate a tailored resume (reordered bullets, matched keywords) when `resumeVariant: "tailored"`; attach the variant file.
3. **Answer-bank learning** — when the user corrects an AI-guessed answer in Review, upsert it as a verified ReusableAnswer keyed to the question.
4. **Weekly scorecard email** — submitted / responses / interviews / response-rate trend.
5. **Auto-tune targeting** — analyze Tracker outcomes by title/industry/score band; shift JobPreferences weighting.
6. **Scheduled follow-up drafts** — auto-draft at +7 days of silence, surface in Tracker.
7. **Inbox integration** — parse confirmation/rejection/interview emails to auto-update Tracker statuses.
