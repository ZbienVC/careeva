# Careeva - Job Search & Application Assistant Backend

A production-ready Next.js 15 backend for managing job search, resume parsing, and application tracking.

## Features

- 🔐 **User Authentication** - Email-based login with NextAuth v5
- 📄 **Resume Upload & Parsing** - PDF/DOCX support with OpenAI gpt-4o-mini
- 💼 **Job Management** - Create, read, update, delete jobs
- 🎯 **Job Scoring** - AI-powered matching between resume and job descriptions
- 📊 **Application Tracking** - Track applications and their status
- 👤 **User Profiles** - Store extracted resume data and onboarding preferences

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: NextAuth v5
- **AI**: OpenAI API (gpt-4o-mini)
- **Styling**: TailwindCSS

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- OpenAI API key

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000/api/`

## API Endpoints

### Authentication
- `POST /api/auth/signin` - Sign in with email
- `GET /api/auth/callback/email` - Email callback

### Profile
- `GET /api/profile` - Get user profile
- `POST /api/profile` - Update user profile

### Resume Upload
- `POST /api/upload` - Upload and parse resume (PDF/DOCX)

### Onboarding
- `POST /api/onboarding` - Complete onboarding (8 core questions)

### Jobs
- `GET /api/jobs` - List user's jobs
- `POST /api/jobs` - Create a new job
- `GET /api/jobs/[id]` - Get job details
- `PUT /api/jobs/[id]` - Update job
- `DELETE /api/jobs/[id]` - Delete job

### Job Scoring
- `POST /api/score` - Score a job against user's resume
- `GET /api/score` - Get all scores or specific score by jobId

## Environment Variables

```env
DATABASE_URL=postgresql://...
NEXTAUTH_SECRET=your-secret-key
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
```

## Database Schema

### Key Tables

- **users** - User accounts
- **user_profiles** - Parsed resume data + onboarding preferences
- **jobs** - Job postings
- **job_scores** - Resume match scores
- **applications** - Application tracking
- **writing_samples** - Saved cover letters/writing samples

## Project Structure

```
careeva/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/    # NextAuth handler
│   │   ├── upload/                 # Resume upload & parsing
│   │   ├── profile/                # User profile
│   │   ├── onboarding/             # Onboarding flow
│   │   ├── jobs/                   # Job CRUD
│   │   └── score/                  # Job scoring
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── auth.ts                     # NextAuth config
│   ├── db.ts                       # Prisma client
│   ├── resume-parser.ts            # Resume parsing logic
│   └── job-scorer.ts               # Job matching logic
├── prisma/
│   └── schema.prisma               # Database schema
└── package.json
```

## Implementation Details

### Resume Parsing

- Accepts PDF and DOCX files
- Extracts: skills, roles, industries, years of experience, education, technologies
- Uses OpenAI gpt-4o-mini for structured extraction

### Job Scoring

- Simple keyword matching + skill overlap calculation
- Weights:
  - Skills: 35%
  - Role relevance: 25%
  - Technologies: 25%
  - Experience: 15%
- Returns 0-100 score with detailed reasoning

### Authentication

- Email-based passwordless login
- Session management with NextAuth
- User creation on first sign-in

## Testing

```bash
# Example: Upload resume
curl -X POST http://localhost:3000/api/upload \
  -H "Content-Type: multipart/form-data" \
  -F "file=@resume.pdf"

# Example: Create job
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Engineer",
    "company": "Tech Corp",
    "description": "...",
    "requirements": "..."
  }'

# Example: Score job
curl -X POST http://localhost:3000/api/score \
  -H "Content-Type: application/json" \
  -d '{"jobId": "job-id-here"}'
```

## Performance Notes

- Resume parsing: ~2-5 seconds (OpenAI API call)
- Database queries: Optimized with indexes on userId
- Job scoring: <100ms (local calculation)

## Next Steps

- Module 2: Frontend UI (React components)
- Module 3: Cover letter generation
- Module 4: LinkedIn/Indeed integration

## License

MIT
