# Deploying the Apply Worker (required for auto-apply)

The web app only **queues** applications. A separate worker service fills the
ATS forms with a real browser, screenshots them for your approval, and submits.
**Until this service is deployed, queued applications will sit in "queued"
forever** (the Review page shows an "apply engine looks offline" banner).

Files (resumes + screenshots) are stored in Postgres, so the two services
need NOTHING shared except `DATABASE_URL` — no volumes required.

## One-time setup on Railway (~5 minutes)

### 1. Create the worker service
- Railway project → **New → Service → GitHub Repo** → pick this same repo
- **Leave Root Directory EMPTY** (the build needs `prisma/schema.prisma` from
  the repo root)
- Service **Settings → Config-as-code → Config file path**: `worker/railway.toml`
  — this sets the build command (installs Chromium + Playwright deps, generates
  the Prisma client, compiles TypeScript) and the start command automatically.

### 2. Environment variables on the worker service
| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Reference the same Postgres as the web app (`${{Postgres.DATABASE_URL}}`) | Yes |
| `WORKER_POLL_MS` | `5000` (default) | No |
| `HEADLESS` | `true` (default) | No |

### 3. Deploy and verify
- Deploy the worker. Logs should show:
  `[worker-xxxx] Careeva apply worker starting (poll 5000ms, headless=true)`
- **Re-upload your resume once** on the Profile page if you uploaded it before
  this version — files now live in the database.
- In the app: run **Automate → Auto-Apply (Safe)** (or Auto-Apply on a job).
- Within ~30–90s the task should move `queued → filling → awaiting_approval`
  in the **Review** page, with a screenshot of the filled form.
- Click **Approve & Submit** — the task moves to `submitted` and the
  application appears as **Applied** in the Tracker.

## How submission works (so you can trust it)
- Adapters drive a real Chromium via Playwright for **Greenhouse, Lever,
  Ashby, Workday (best-effort, stops at login walls), and generic forms**.
- Your actual uploaded resume file (PDF/DOCX) is attached to the form.
- EEO/demographic questions are only answered from your stored answers,
  otherwise set to "Decline to self-identify".
- Default mode is **approve-first**: nothing is ever submitted without your
  click. Full-auto additionally requires a perfect fill (no AI guesses,
  resume attached) AND a track record of 10 human-approved submissions.
- Pacing is randomized (30–90s between applications by default) and your
  daily cap applies (Settings → Volume & pacing).

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Tasks stuck in `queued` / offline banner | Worker not running | Check worker service logs on Railway |
| `Stored resume file not found` | Resume uploaded before DB-backed storage | Re-upload on Profile, then Retry the task |
| Tasks go to `needs_review` with "No adapter" | Job's ATS isn't supported for autofill | Open the form link and apply manually; the packet (answers + letter) is in the task detail |
| Screenshot 404 in Review | Worker crashed before saving | Hit Retry on the task |
