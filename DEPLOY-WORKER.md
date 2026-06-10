# Deploying the Apply Worker (required for auto-apply)

The web app only **queues** applications. A separate worker service fills the
ATS forms with a real browser, screenshots them for your approval, and submits.
**Until this service is deployed, queued applications will sit in "queued"
forever.**

## One-time setup on Railway (~10 minutes)

### 1. Attach a Volume to the web service (if not already)
- Railway → your Careeva web service → **Settings → Volumes → Attach Volume**
- Mount path: `/data`
- This is where uploaded resumes and form screenshots live. If a volume is
  already attached, note its mount path.

### 2. Create the worker service
- Railway project → **New → Service → GitHub Repo** → pick this same repo
- Service **Settings → Root Directory**: `worker`
- Railway will use `worker/nixpacks.toml` automatically (installs Chromium +
  Playwright deps, generates the Prisma client, builds TypeScript).

### 3. Attach the SAME volume to the worker
- Worker service → **Settings → Volumes → Attach** the volume from step 1
- **Mount path must be identical** (e.g. `/data`). The worker reads the resume
  files the web app saved and writes screenshots the web app serves.

### 4. Environment variables on the worker service
| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Reference the same Postgres as the web app (`${{Postgres.DATABASE_URL}}`) | Yes |
| `WORKER_POLL_MS` | `5000` (default) | No |
| `HEADLESS` | `true` (default) | No |

`RAILWAY_VOLUME_MOUNT_PATH` is set automatically when the volume is attached.

### 5. Deploy and verify
- Deploy the worker. Logs should show:
  `[worker-xxxx] Careeva apply worker starting (poll 5000ms, headless=true)`
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
  click, and every submission requires the ATS to show a confirmation page
  before the task is marked submitted.
- Pacing is randomized (30–90s between applications by default) and a daily
  cap applies (Settings → Volume & pacing).

## Troubleshooting
| Symptom | Cause | Fix |
|---|---|---|
| Tasks stuck in `queued` | Worker not running | Check worker service logs on Railway |
| `Resume file not found on the worker volume` | Volume not shared or different mount path | Attach the same volume at the same path to both services; re-upload resume |
| Tasks go to `needs_review` with "No adapter" | Job's ATS isn't supported for autofill | Open the form link and apply manually; the packet (answers + letter) is in the task detail |
| Screenshot 404 in Review | Worker crashed before saving | Hit Retry on the task |
