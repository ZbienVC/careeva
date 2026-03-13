# Railway Deployment Guide - Careeva

## Quick Setup (5-10 minutes)

This guide walks you through deploying Careeva to Railway.

### Prerequisites

- Railway account (you already have one with Splash Signal)
- GitHub authenticated with Railway
- Careeva repo pushed to GitHub (done ✅)

---

## STEP 1: Create Railway Project

1. Go to **railway.app**
2. Log in to your account
3. Click **New Project**
4. Select **Deploy from GitHub**
5. Find and select `ZbienVC/careeva`
6. Click **Deploy**

Railway will auto-detect Next.js and start building. ⏳ (Wait 2-3 min for it to appear)

---

## STEP 2: Add PostgreSQL Database

1. In your Careeva project, click **+ Add Service**
2. Select **PostgreSQL**
3. Railway will create a database and auto-generate `DATABASE_URL` env var ✅
4. In the PostgreSQL service, go to **Settings** and verify:
   - **Database Name**: Set to `careeva_prod` (or keep default `railway`)
   - Copy the `DATABASE_URL` (you'll need it next)

---

## STEP 3: Configure Environment Variables

Go to your **Careeva service** → **Variables** tab and add these:

### Required Variables

```
NODE_ENV=production
NEXTAUTH_SECRET=<GENERATE A RANDOM 32+ CHAR STRING>
NEXTAUTH_URL=https://careeva-production.up.railway.app  (OR YOUR CUSTOM DOMAIN)
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>
NEXT_PUBLIC_API_URL=https://careeva-production.up.railway.app  (SAME AS NEXTAUTH_URL)
DATABASE_URL=<FROM POSTGRESQL SERVICE - RAILWAY AUTO-LINKS THIS>
```

### How to Generate NEXTAUTH_SECRET

Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Example output: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6`

---

## STEP 4: Wait for Build & Deployment

1. Go to **Deployments** tab
2. Watch the build logs
3. Expected output:
   ```
   ✓ Compiled successfully
   ✓ Generating static pages
   ✓ Build complete
   ```

⏳ First deployment: 5-10 minutes
⏳ Subsequent deployments: 1-2 minutes

---

## STEP 5: Database Migrations

Railway automatically runs build scripts. Prisma migrations should run automatically, but if not:

1. Go to **Deployments** → Latest deployment
2. Click **Deploy Logs**
3. Look for: `Database has been updated`
4. If you see migration errors, check `DATABASE_URL` is correct

---

## STEP 6: Get Your Live URL

1. Go to your Careeva service
2. In the top right, you'll see a domain like:
   ```
   careeva-production.up.railway.app
   ```
3. Click the domain → your app opens in the browser

---

## STEP 7: Test Features

### Test 1: Frontend Loads
```
https://careeva-production.up.railway.app
```
✅ Should see login page

### Test 2: API Health
```
https://careeva-production.up.railway.app/api/auth/signin
```
✅ Should return NextAuth signin form

### Test 3: Login Flow
1. Go to login page
2. Enter your email
3. Check your email for magic link
4. Click link → dashboard loads

### Test 4: Jobs List
1. After login, go to `/dashboard/jobs`
2. Try creating a job:
   ```
   POST /api/jobs
   {
     "title": "Senior Engineer",
     "company": "TechCorp",
     "description": "Build great things",
     "requirements": "5+ years React"
   }
   ```

### Test 5: Resume Upload
1. Go to `/dashboard/profile`
2. Upload a PDF resume
3. Check that parsing works (should extract skills, experience, etc.)

### Test 6: Job Scoring
1. Create a job (from Test 4)
2. Submit a resume
3. Score the job:
   ```
   POST /api/score
   {
     "jobId": "<job-id-from-test-4>"
   }
   ```
✅ Should return score (0-100) and reasoning

---

## STEP 8: (Optional) Set Custom Domain

If you want `careeva.com` instead of `careeva-production.up.railway.app`:

1. Go to Careeva service → **Settings**
2. Scroll to **Domain**
3. Add custom domain
4. Follow DNS setup instructions
5. Update `NEXTAUTH_URL` in Variables to match new domain

---

## Troubleshooting

### ❌ Build Fails

**Check:**
- Node version compatibility
- `npm run build` works locally
- All env vars are set
- DATABASE_URL is correct

**Fix:**
```bash
cd careeva
npm install
npm run prisma:generate
npm run build
```

### ❌ 404 Errors

**Issue:** NEXTAUTH_URL not set correctly
**Fix:** Make sure `NEXTAUTH_URL` matches your Railway domain exactly

### ❌ Login Fails

**Issue:** NEXTAUTH_SECRET not set
**Fix:** 
1. Generate new secret (see Step 3)
2. Update in Railway Variables
3. Redeploy

### ❌ Database Connection Fails

**Issue:** DATABASE_URL malformed or PostgreSQL not linked
**Fix:**
1. Check PostgreSQL service is running
2. Copy DATABASE_URL directly from PostgreSQL service vars
3. Paste into Careeva service vars
4. Redeploy

### ❌ NextAuth Email Not Sending

**Issue:** Email provider not configured
**Note:** Default NextAuth setup uses email provider.  Works out of box.
**If not working:**
1. Check email address is valid
2. Check spam folder
3. Verify NEXTAUTH_URL is correct (affects link generation)

---

## Deployment Checklist

- [ ] GitHub pushed (`deployment: careeva on railway`)
- [ ] Railway project created
- [ ] PostgreSQL service added
- [ ] Environment variables configured
- [ ] Build succeeded (check Deployments tab)
- [ ] Database migrations ran
- [ ] Frontend loads (login page visible)
- [ ] API responds (`/api/auth/signin`)
- [ ] Login works (email + magic link)
- [ ] Resume upload works
- [ ] Job scoring works
- [ ] No errors in browser console
- [ ] Live URL obtained: `https://careeva-production.up.railway.app`

---

## Next Steps After Deployment

1. **Monitor Logs** - Check Railway Logs tab for any errors
2. **Test with Real Data** - Upload your resume, create jobs, test scoring
3. **Share URL** - Get feedback from users
4. **Module 3** - Cover letter generation (if needed)

---

## Support

If you get stuck:

1. Check Railway Logs (Deployments → View Logs)
2. Check browser console (F12)
3. Verify all env vars are set
4. Try redeploying: Settings → Redeploy

**Time Target:** 30-45 minutes total

Good luck! 🚀
