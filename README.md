# ShotFlow — VFX Pipeline Manager

Professional shot tracking and pipeline management for film & episodic VFX production.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **UI:** Tailwind CSS + shadcn/ui + Radix primitives
- **Deploy:** Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your Supabase project URL and keys

# Run database migrations in Supabase Dashboard SQL editor:
# 1. supabase/migrations/00001_initial_schema.sql
# 2. supabase/migrations/00002_seed_data.sql

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> **Note:** The app works with mock data out of the box — no Supabase connection required for UI development. Connect Supabase for persistent data.

## Features

- **Dashboard** — Project overview with shot status breakdown and activity feed
- **Projects** — Create and manage VFX projects with progress tracking
- **Shots Board** — Kanban + table view with filters (sequence, assignee, status, complexity) and search
- **Shot Detail** — Version timeline, notes per version, shot metadata, status controls, assignment
- **Turnover Import** — Drag-and-drop EDL upload, parse preview, sequence selection, warning display
- **Delivery Tracker** — Delivery specs (EXR/DPX/ProRes), color-coded status, bulk actions
- **Client Portal** — Restricted view for client review/approval with version switching and feedback
- **User Management** — Invite users, assign roles (Admin, Supervisor, Artist, Client)

## EDL Parser

The built-in EDL parser handles CMX 3600 format (standard Avid/Resolve export):

- Event number, reel name, track type, edit type
- Source TC in/out, Record TC in/out
- Comment lines (`* FROM CLIP NAME`, `* SOURCE FILE`, etc.)
- Drop-frame and non-drop-frame timecodes
- Transition types (Cut, Dissolve, Wipe, Key)
- Parse warnings for malformed lines

See `docs/sample.edl` for a test file.

## Deployment (Vercel)

### Quick Deploy

1. Push to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Select the `shotflow` repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon key
5. Deploy

### Manual Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Login & deploy
vercel login
vercel --prod
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | For DB features |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | For DB features |

The app runs fully with mock data when Supabase is not configured.

### Production Checklist

- [x] `npm run build` passes cleanly
- [x] `vercel.json` configured with security headers
- [x] `next.config.mjs` with `poweredByHeader: false`, `reactStrictMode: true`
- [x] Dark mode enforced via `<html class="dark">`

## Database

Schema is defined in `supabase/migrations/`. Run these SQL files in your Supabase project's SQL editor or via the Supabase CLI:

```bash
supabase db push
```

## Project Structure

```
src/
├── app/
│   ├── (app)/              # App pages with sidebar layout
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── shots/[id]/
│   │   ├── turnover/
│   │   ├── deliveries/
│   │   ├── client/
│   │   └── users/
│   └── globals.css
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── sidebar.tsx
│   ├── header.tsx
│   └── status-badge.tsx
└── lib/
    ├── supabase.ts         # Supabase client
    ├── database.types.ts   # TypeScript types for DB
    ├── utils.ts
    ├── mock-data.ts
    └── edl-parser.ts       # CMX 3600 EDL parser
docs/
└── sample.edl              # Sample EDL for testing
supabase/
└── migrations/             # SQL migrations
```
