# Careeva Setup — Environment, Job Sources, Storage

Updated alongside the Phase 2 rearchitecture. This is the single reference for
what to set on Railway to bring every feature online.

## 1. Required environment variables (Railway → careeva service → Variables)

| Variable | What it does | How to get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection | Auto-linked from the Railway PostgreSQL service |
| `SESSION_SECRET` | Signs login session cookies (Phase 1) | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | Claude (Sonnet 4.6) for cover letters, resume writing, behavioral answers | platform.claude.com → Console → API Keys. **Note: this is separate from a claude.ai Pro/Max subscription — subscriptions do not include API access.** Pay-as-you-go; Careeva's per-application usage is cents. |
| `OPENAI_API_KEY` | GPT-4o-mini for resume parsing, short answers, scoring rationale (also the fallback if no Anthropic key) | platform.openai.com |

At least one of `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` must be set; both is best
(Claude writes, GPT-4o-mini parses cheaply).

## 2. File storage (resumes) — Railway Volume

1. Railway → careeva service → **Attach Volume** (e.g. mount path `/data`).
2. Done. The app reads `RAILWAY_VOLUME_MOUNT_PATH` automatically.
3. Optional override: set `STORAGE_DIR` to force a specific path.

Uploaded resumes are now stored as **real files** that survive deploys:
- `POST /api/upload` — upload + AI parse (unchanged from the frontend's view)
- `GET /api/upload` — list your resumes
- `GET /api/upload?id=<resumeId>` — **download** the original file
- `DELETE /api/upload?id=<resumeId>` — delete record + file (this previously 405'd; now works)

Files uploaded **before** this change only have parsed text, not the file —
re-upload your resume once after deploying.

## 3. Job sources — what's on by default, what each key unlocks

Sources auto-enable based on which keys exist (`getAvailableSources()` in
`lib/job-search.ts`). No code changes needed — just add keys.

**Always on (free, no key):**
- Greenhouse / Lever / Ashby company boards (≈170 tech companies, direct ATS APIs)
- Remotive, The Muse, Arbeitnow, We Work Remotely, Remote.co

**Unlocked by keys (add any/all):**

| Variable(s) | Source | Coverage | Cost |
|---|---|---|---|
| `RAPIDAPI_KEY` | **JSearch** | Google for Jobs index → includes postings from **LinkedIn, Indeed, ZipRecruiter, Glassdoor, Monster** and thousands of career sites. The single highest-leverage key. | Free tier ≈200 req/mo; paid tiers cheap. rapidapi.com → JSearch |
| `SERP_API_KEY` | **Google Jobs** (SerpAPI) | Same Google for Jobs index, alternative provider | Free 100 searches/mo |
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | **Adzuna** | Large US/UK aggregator with salary data | Free 250 calls/day. developer.adzuna.com |
| `DICE_API_KEY` | **Dice** | US tech jobs | Previously hardcoded with a placeholder key — now env-driven |
| `USAJOBS_HOST` + `USAJOBS_KEY` | **USAJobs** | US federal jobs | Free. developer.usajobs.gov |

**Why not scrape LinkedIn/Glassdoor/Monster/ZipRecruiter/Snagajob directly:**
none of them offer public job-search APIs, and scraping them violates their
terms of service and breaks constantly behind bot-protection. JSearch covers
their postings legitimately through the Google for Jobs index — that's the
recommended path, and it's wired in.

**Note:** Indeed RSS and Monster RSS adapters exist in the code but those feeds
were discontinued upstream; they fail soft (return nothing) and are excluded
from the default source list.

## 4. Where sources are now wired (this was the gap)

Previously, the multi-source engine existed but **only** `/api/jobs/search`
used it — the automation pipeline only synced the ~170 hardcoded ATS boards.
Now:

- `POST /api/automate` → Step 1 syncs ATS boards **and** runs the aggregator
  across every available source, using your Job Preferences target titles
  (fallback: your most recent work-history titles).
- `POST /api/cron/sync` → same, per user, on schedule.

Set your **target titles** in Job Preferences — that's what drives the search
queries everywhere.

## 5. Automation / cron

| Variable | What it does |
|---|---|
| `CRON_SECRET` | Protects `POST /api/cron/sync`. Set it, then add a Railway cron service calling the endpoint with `Authorization: Bearer $CRON_SECRET` every 6h. |

## 6. AI integration summary

- Writing-quality tasks (cover letters, resume summaries/bullets, behavioral
  answers) → **Claude Sonnet 4.6** (`claude-sonnet-4-6`, updated from the stale
  `claude-sonnet-4-5` pin) via `ANTHROPIC_API_KEY`.
- Parsing/short answers/scoring → GPT-4o-mini via `OPENAI_API_KEY`.
- Either key alone works (automatic fallback); both is recommended.

## 7. Application answers — how they're resolved now

Order of precedence when building an application packet (`lib/auto-apply.ts`,
now wired through the shared engine in `lib/answer-engine.ts`):

1. **Your stored, verified answers** (Reusable Answers) — used verbatim.
2. **Profile-derived answers** for standard questions (work authorization,
   sponsorship, salary, remote preference, relocation, years of experience,
   start date, LinkedIn/GitHub/portfolio/phone) — same resolution pipeline as
   `/api/answers/resolve`, single source of truth.
3. **AI-generated** per-job answers (why this company / why this role),
   grounded in your profile + the JD.
4. EEO questions (gender, ethnicity, veteran, disability) are **never**
   auto-answered unless you've explicitly stored an answer.

Anything unresolved is left blank and surfaces in the review queue rather than
being guessed.


---

## 8. Phase 3 — The Apply Worker (added)

Careeva now has a second service: a Playwright worker that actually fills and
submits application forms with your REAL resume file.

### Deploy (Railway, same project)
1. **New Service → Deploy from same GitHub repo.**
2. Service Settings → **Root Directory: `/worker`**.
3. **Attach the SAME Volume** as the web service, same mount path.
4. Variables: `DATABASE_URL` (same Postgres). Optional: `WORKER_POLL_MS`, `HEADLESS=false` for local debugging.
5. Deploy. Logs should show `Careeva apply worker starting`.

### How a run works now
1. Automation page → pick mode → Run. Jobs sync (boards + all free sources), get scored.
2. Jobs above your **apply gate** (Settings, default 50) get full packets built and are **enqueued**.
3. The worker picks tasks up, opens the real form, attaches your resume file,
   fills every field it can answer, screenshots the result.
4. **approve_first** (default): task waits in **Review Queue** — you see the
   screenshot + field report, click Approve, worker submits.
   **fill_and_leave**: you open the form from the queue and finish manually.
   **full_auto**: worker submits immediately. All modes per-application visible.
5. Submitted tasks update the Tracker automatically.

### Adapters
Greenhouse, Lever, Ashby (full fill + file upload + submit), Workday
(best-effort: guest paths only; account/login walls hand off to you — by design,
credentials are never automated), and a generic best-effort filler for any other
form. EEO questions are only answered from your explicitly stored answers, else
"Decline to self-identify" where offered.

### LinkedIn strategy (no-ban approach)
Easy Apply is NOT botted (that's the highest-risk automation on the internet for
account bans). Instead: LinkedIn job URLs are resolved through their "apply on
company website" redirect to the real ATS, where the worker applies normally;
true Easy Apply jobs get a one-click companion view in the Review Queue with
your full packet beside the form for fast manual paste.

### New pages
- `/dashboard/review` — Review Queue (approve / retry / cancel / open form / screenshots)
- `/dashboard/settings` — all automation defaults, tunable anytime (mode,
  gates, volume cap [0 = unlimited], pacing delays 30–90s default, duplicate
  policy, cover-letter attach, unknown-question handling)

### New job sources (free, no key)
RemoteOK, Jobicy, Himalayas, Hacker News "Who is hiring" — on by default
alongside the existing free set.

### Migration note
`20260610000001_apply_engine_and_drift_fix` consolidates the previously
untracked evaluation/star tables (guarded `IF NOT EXISTS`, safe whether or not
you ran the loose SQL on prod) and adds the queue + settings columns. If
`prisma migrate deploy` reports drift on first deploy, run
`npx prisma migrate resolve --applied <name>` per its instructions — the SQL is
idempotent.
